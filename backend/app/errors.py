"""Erreurs de l'API : un code stable que l'extension traduit, sans jamais renvoyer le texte recu."""
from __future__ import annotations


def error_body(code: str, message: str, **extra) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


class KamaError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(code)
        self.status, self.code, self.message = status, code, message


def unmasked() -> KamaError:
    return KamaError(422, "unmasked_content", "Le texte contient encore des données à masquer.")


def unsupported_language() -> KamaError:
    return KamaError(400, "unsupported_language", "Cette langue n'est pas disponible.")


def busy() -> KamaError:
    return KamaError(503, "busy", "Le service est occupé. Réessayez dans un instant.")
