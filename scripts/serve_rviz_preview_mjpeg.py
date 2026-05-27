#!/usr/bin/env python3

from __future__ import annotations

import argparse
import http.server
import os
import re
import socketserver
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Iterable


LOG_PREFIX = "[rviz-preview]"
MJPEG_BOUNDARY = "ffmpeg"
PROXY_ENV_KEYS = (
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
)


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    display_name: str
    window_regex: str
    capture_mode: str
    wait_timeout_sec: int
    framerate: int
    max_width: int


@dataclass(frozen=True)
class Geometry:
    x: int
    y: int
    width: int
    height: int


@dataclass(frozen=True)
class WindowTarget:
    window_id: str
    title: str
    class_name: str
    geometry: Geometry


def log(message: str) -> None:
    print(f"{LOG_PREFIX} {message}", flush=True)


def fail(message: str) -> None:
    print(f"{LOG_PREFIX} ERROR: {message}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def parse_args(argv: list[str]) -> Config:
    parser = argparse.ArgumentParser(
        description=(
            "等待 X11 display / RViz 窗口可用，并在 /stream 提供 MJPEG 路径预览。"
        )
    )
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8090")))
    parser.add_argument("--display", dest="display_name", default=os.getenv("DISPLAY", ":0"))
    parser.add_argument(
        "--window-regex",
        default=os.getenv("WINDOW_REGEX", "rviz"),
    )
    parser.add_argument(
        "--capture-mode",
        default=os.getenv("CAPTURE_MODE", "window"),
        choices=("window", "display"),
    )
    parser.add_argument(
        "--wait-timeout",
        dest="wait_timeout_sec",
        type=int,
        default=int(os.getenv("WAIT_TIMEOUT_SEC", "60")),
    )
    parser.add_argument(
        "--framerate",
        type=int,
        default=int(os.getenv("FRAMERATE", "5")),
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=int(os.getenv("MAX_WIDTH", "960")),
    )
    args = parser.parse_args(argv)
    return Config(
        host=args.host,
        port=args.port,
        display_name=args.display_name,
        window_regex=args.window_regex,
        capture_mode=args.capture_mode,
        wait_timeout_sec=args.wait_timeout_sec,
        framerate=args.framerate,
        max_width=args.max_width,
    )


def x11_env(config: Config) -> dict[str, str]:
    env = os.environ.copy()
    env["DISPLAY"] = config.display_name
    for key in PROXY_ENV_KEYS:
        env.pop(key, None)
    return env


def run_text_command(
    cmd: Iterable[str],
    *,
    config: Config,
    check: bool = True,
) -> str:
    proc = subprocess.run(
        list(cmd),
        check=False,
        capture_output=True,
        text=True,
        env=x11_env(config),
    )
    if check and proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "command failed")
    return proc.stdout


def wait_for_display(config: Config) -> None:
    deadline = time.time() + config.wait_timeout_sec
    while True:
        try:
            run_text_command(("xwininfo", "-root"), config=config)
            return
        except RuntimeError:
            if time.time() >= deadline:
                fail(f"在 {config.wait_timeout_sec}s 内未能连接 display {config.display_name}")
            time.sleep(1)


def find_window_target(config: Config) -> WindowTarget | None:
    tree = run_text_command(("xwininfo", "-root", "-tree"), config=config)
    pattern = re.compile(config.window_regex, re.IGNORECASE)
    candidates: list[WindowTarget] = []

    for line in tree.splitlines():
        match = re.match(
            r'\s*(0x[0-9a-fA-F]+)\s+"([^"]*)":\s+\("([^"]*)" "([^"]*)"\)\s+'
            r"(\d+)x(\d+)\+[0-9-]+\+[0-9-]+\s+\+([0-9-]+)\+([0-9-]+)",
            line,
        )
        if not match:
            continue
        window_id, title, class_instance, class_name, width, height, x, y = match.groups()
        haystacks = (title, class_instance, class_name)
        if not any(pattern.search(value) for value in haystacks if value):
            continue
        candidates.append(
            WindowTarget(
                window_id=window_id,
                title=title,
                class_name=class_name,
                geometry=Geometry(
                    x=int(x),
                    y=int(y),
                    width=int(width),
                    height=int(height),
                ),
            )
        )

    if not candidates:
        return None

    def score(candidate: WindowTarget) -> tuple[int, int, int, int]:
        area = candidate.geometry.width * candidate.geometry.height
        is_exact_rviz_surface = 1 if candidate.title.lower() == "rviz2" else 0
        has_rviz_class = 1 if "rviz" in candidate.class_name.lower() else 0
        title_len = len(candidate.title)
        return (is_exact_rviz_surface, has_rviz_class, area, title_len)

    return max(candidates, key=score)


def wait_for_window(config: Config) -> WindowTarget:
    deadline = time.time() + config.wait_timeout_sec
    while True:
        target = find_window_target(config)
        if target:
            return target
        if time.time() >= deadline:
            raise TimeoutError(
                f"在 {config.wait_timeout_sec}s 内未找到匹配 /{config.window_regex}/ 的窗口"
            )
        time.sleep(1)


def parse_geometry_block(text: str) -> Geometry:
    values: dict[str, int] = {}
    patterns = {
        "x": r"Absolute upper-left X:\s+(-?\d+)",
        "y": r"Absolute upper-left Y:\s+(-?\d+)",
        "width": r"Width:\s+(\d+)",
        "height": r"Height:\s+(\d+)",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if not match:
            raise RuntimeError(f"无法解析 {key}")
        values[key] = int(match.group(1))
    return Geometry(**values)


def window_geometry(config: Config, window_id: str) -> Geometry:
    info = run_text_command(("xwininfo", "-id", window_id), config=config)
    return parse_geometry_block(info)


def display_geometry(config: Config) -> Geometry:
    info = run_text_command(("xdpyinfo",), config=config)
    match = re.search(r"dimensions:\s+(\d+)x(\d+)\s+pixels", info)
    if not match:
        raise RuntimeError("无法解析 display 尺寸")
    width, height = (int(value) for value in match.groups())
    return Geometry(x=0, y=0, width=width, height=height)


def resolve_geometry(config: Config) -> Geometry:
    if config.capture_mode == "display":
        return display_geometry(config)
    return wait_for_window(config).geometry


def ffmpeg_command(config: Config, geometry: Geometry) -> list[str]:
    return [
        "ffmpeg",
        "-loglevel",
        "error",
        "-f",
        "x11grab",
        "-draw_mouse",
        "0",
        "-video_size",
        f"{geometry.width}x{geometry.height}",
        "-framerate",
        str(config.framerate),
        "-i",
        f"{config.display_name}+{geometry.x},{geometry.y}",
        "-vf",
        f"scale={config.max_width}:-2:force_original_aspect_ratio=decrease",
        "-q:v",
        "6",
        "-f",
        "mpjpeg",
        "pipe:1",
    ]


def jpeg_from_xwd_bytes(config: Config, xwd_bytes: bytes) -> bytes:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-f",
            "xwd_pipe",
            "-i",
            "pipe:0",
            "-vf",
            f"scale={config.max_width}:-2:force_original_aspect_ratio=decrease",
            "-frames:v",
            "1",
            "-q:v",
            "6",
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
            "pipe:1",
        ],
        input=xwd_bytes,
        capture_output=True,
        env=x11_env(config),
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        error = proc.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(error or "ffmpeg could not convert xwd frame to jpeg")
    return proc.stdout


def capture_window_jpeg(config: Config, target: WindowTarget) -> bytes:
    xwd_proc = subprocess.run(
        ["xwd", "-id", target.window_id, "-silent"],
        capture_output=True,
        env=x11_env(config),
        check=False,
    )
    if xwd_proc.returncode != 0 or not xwd_proc.stdout:
        error = xwd_proc.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(error or f"xwd could not capture window {target.window_id}")
    return jpeg_from_xwd_bytes(config, xwd_proc.stdout)


def write_mjpeg_part(handler: http.server.BaseHTTPRequestHandler, jpeg_bytes: bytes) -> None:
    handler.wfile.write(f"--{MJPEG_BOUNDARY}\r\n".encode("ascii"))
    handler.wfile.write(b"Content-Type: image/jpeg\r\n")
    handler.wfile.write(f"Content-Length: {len(jpeg_bytes)}\r\n\r\n".encode("ascii"))
    handler.wfile.write(jpeg_bytes)
    handler.wfile.write(b"\r\n")
    handler.wfile.flush()


def stream_window_capture(
    handler: http.server.BaseHTTPRequestHandler,
    config: Config,
) -> None:
    target = wait_for_window(config)
    frame_interval = 1.0 / max(config.framerate, 1)
    log(
        "client connected; xwd window stream http://"
        f"{config.host}:{config.port}/stream "
        f"title={target.title!r} class={target.class_name!r} "
        f"region {target.geometry.width}x{target.geometry.height}+{target.geometry.x}+{target.geometry.y}"
    )

    while True:
        started = time.monotonic()
        try:
            jpeg_bytes = capture_window_jpeg(config, target)
        except RuntimeError:
            target = wait_for_window(config)
            jpeg_bytes = capture_window_jpeg(config, target)
        write_mjpeg_part(handler, jpeg_bytes)
        elapsed = time.monotonic() - started
        sleep_for = frame_interval - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)


def stream_display_capture(
    handler: http.server.BaseHTTPRequestHandler,
    config: Config,
) -> None:
    geometry = resolve_geometry(config)
    log(
        "client connected; x11grab display stream http://"
        f"{config.host}:{config.port}/stream "
        f"region {geometry.width}x{geometry.height}+{geometry.x}+{geometry.y}"
    )
    proc = subprocess.Popen(
        ffmpeg_command(config, geometry),
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=x11_env(config),
        bufsize=0,
    )

    try:
        assert proc.stdout is not None
        while True:
            chunk = proc.stdout.read(64 * 1024)
            if not chunk:
                break
            handler.wfile.write(chunk)
            handler.wfile.flush()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class PreviewHandler(http.server.BaseHTTPRequestHandler):
    server_version = "RvizPreviewHTTP/1.0"

    def do_HEAD(self) -> None:  # noqa: N802
        if self.path not in {"/stream", "/"}:
            self.send_error(404, "not found")
            return

        self.send_response(200)
        self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path not in {"/stream", "/"}:
            self.send_error(404, "not found")
            return

        try:
            self.send_response(200)
            self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.end_headers()
            if self.server.config.capture_mode == "window":
                stream_window_capture(self, self.server.config)
            else:
                stream_display_capture(self, self.server.config)
        except TimeoutError as exc:
            self.send_error(503, str(exc))
        except RuntimeError as exc:
            self.send_error(500, str(exc))
        except BrokenPipeError:
            pass
        except ConnectionResetError:
            pass
        finally:
            log("client disconnected")

    def log_message(self, format: str, *args: object) -> None:
        return


def main(argv: list[str]) -> int:
    config = parse_args(argv)
    wait_for_display(config)
    log(
        f"serve MJPEG preview on http://{config.host}:{config.port}/stream "
        f"(display={config.display_name}, mode={config.capture_mode}, regex=/{config.window_regex}/)"
    )
    server = ThreadingHTTPServer((config.host, config.port), PreviewHandler)
    server.config = config  # type: ignore[attr-defined]
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        log("stopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
