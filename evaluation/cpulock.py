"""Verrou entre processus : un seul gros modele charge a la fois (Windows).

Le systeme libere le verrou si le processus meurt : il ne peut pas rester bloque.
"""
import msvcrt
import os
import time

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs", "cpu.lock")


class CpuLock:
    def __init__(self):
        self.file = None

    def acquire(self):
        self.file = open(PATH, "a+b")
        while True:
            try:
                self.file.seek(0)
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
                return
            except OSError:
                time.sleep(5)

    def release(self):
        if self.file:
            self.file.seek(0)
            msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
            self.file.close()
            self.file = None
