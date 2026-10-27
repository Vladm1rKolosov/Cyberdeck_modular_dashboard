from __future__ import annotations

import asyncio
import platform
import shutil
import socket
import subprocess
import time
from dataclasses import dataclass, field

import psutil


def _round(value: float, digits: int = 1) -> float:
    return round(float(value), digits)


@dataclass
class TelemetryCollector:
    previous_net: object = field(default_factory=psutil.net_io_counters)
    previous_net_at: float = field(default_factory=time.monotonic)

    def _gpu(self) -> dict:
        if not shutil.which("nvidia-smi"):
            return {"available": False, "name": "GPU SENSOR OFFLINE"}
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=2,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=True,
            )
            name, usage, temp, used, total, power = [part.strip() for part in result.stdout.splitlines()[0].split(",")]
            return {
                "available": True,
                "name": name,
                "usage": _round(usage),
                "temperature": _round(temp),
                "memory_used": _round(used, 0),
                "memory_total": _round(total, 0),
                "power": _round(power),
            }
        except (OSError, ValueError, IndexError, subprocess.SubprocessError):
            return {"available": False, "name": "GPU SENSOR OFFLINE"}

    def snapshot(self) -> dict:
        now = time.monotonic()
        net = psutil.net_io_counters()
        elapsed = max(now - self.previous_net_at, 0.001)
        down = max(0, net.bytes_recv - self.previous_net.bytes_recv) / elapsed
        up = max(0, net.bytes_sent - self.previous_net.bytes_sent) / elapsed
        self.previous_net, self.previous_net_at = net, now

        memory = psutil.virtual_memory()
        disk_rows = []
        for partition in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(partition.mountpoint)
            except (PermissionError, OSError):
                continue
            disk_rows.append({
                "name": partition.device.rstrip("\\"),
                "percent": _round(usage.percent),
                "used_gb": _round(usage.used / 1024**3),
                "total_gb": _round(usage.total / 1024**3),
            })

        processes = []
        for proc in psutil.process_iter(["pid", "name", "memory_info"]):
            try:
                rss = proc.info["memory_info"].rss / 1024**2
                processes.append({"pid": proc.info["pid"], "name": proc.info["name"], "memory_mb": _round(rss, 0)})
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        processes.sort(key=lambda item: item["memory_mb"], reverse=True)

        battery = psutil.sensors_battery()
        return {
            "timestamp": time.time(),
            "system": {
                "hostname": socket.gethostname(),
                "os": f"{platform.system()} {platform.release()}",
                "uptime": int(time.time() - psutil.boot_time()),
                "battery": None if battery is None else _round(battery.percent, 0),
                "plugged": None if battery is None else battery.power_plugged,
            },
            "cpu": {
                "name": platform.processor() or "PROCESSOR",
                "usage": _round(psutil.cpu_percent(interval=None)),
                "cores": [_round(value) for value in psutil.cpu_percent(interval=None, percpu=True)],
                "frequency": _round((psutil.cpu_freq().current if psutil.cpu_freq() else 0) / 1000, 2),
            },
            "ram": {
                "usage": _round(memory.percent),
                "used_gb": _round(memory.used / 1024**3),
                "total_gb": _round(memory.total / 1024**3),
            },
            "network": {"down_bps": down, "up_bps": up},
            "disks": disk_rows[:6],
            "processes": processes[:6],
            "gpu": self._gpu(),
        }

    async def collect(self) -> dict:
        return await asyncio.to_thread(self.snapshot)
