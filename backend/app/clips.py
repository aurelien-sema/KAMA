"""Enregistrements humains valides : ils passent avant toute voix de synthese.

Un morceau de texte (la partie d'une phrase entre deux {xN}) qui a ete enregistre par un locuteur
puis valide est rendu tel quel. Seul ce qui n'a pas d'enregistrement va au modele de synthese.
Les fichiers vivent hors du depot public (voix d'une personne) : dossier monte avec les modeles.

Format du dossier  <clips_dir>/<langue>/ :
    manifest.json   {"sample_rate": 16000, "clips": [{"id", "text", "file", "validated_by", "date", "origin"}]}
                    origin : "recorded" (voix humaine, par defaut) ou "synthetic" (voix de synthese generee a l'avance et validee)
    <id>.wav        WAV PCM 16 bits mono
Un clip sans "validated_by" n'est jamais servi.
"""
from __future__ import annotations

import io
import json
import logging
import re
import unicodedata
import wave
from dataclasses import dataclass
from pathlib import Path

from .security.guards import canonical
from .security.masking import SLOT_RE

log = logging.getLogger("kama.clips")

SAMPLE_RATE = 16_000
MAX_CLIP_SECONDS = 15


def piece_key(text: str) -> str:
    """Cle de recherche : sans majuscules, sans ponctuation, sans espaces en trop."""
    return re.sub(r"[^\w']+", " ", canonical(unicodedata.normalize("NFC", text))).strip()


def split_pieces(text: str) -> list[str]:
    """Les morceaux de texte entre les balises, dans l'ordre. Meme decoupage pour servir et pour preparer l'enregistrement."""
    return [p.strip() for p in SLOT_RE.split(text) if piece_key(p)]  # un morceau de ponctuation seule ne se dit pas


def _check_wav(data: bytes) -> bytes:
    with wave.open(io.BytesIO(data), "rb") as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, SAMPLE_RATE):
            raise ValueError("WAV PCM 16 bits, 16 kHz, mono attendu")
        if w.getnframes() / SAMPLE_RATE > MAX_CLIP_SECONDS:
            raise ValueError("clip trop long")
    return data


@dataclass(frozen=True)
class Clip:
    id: str
    text: str
    wav: bytes
    origin: str = "recorded"  # recorded = voix humaine ; synthetic = voix generee une fois pour toutes puis validee


class ClipLibrary:
    def __init__(self, clips: dict[str, Clip] | None = None) -> None:
        self._by_key = clips or {}

    def __len__(self) -> int:
        return len(self._by_key)

    def find(self, piece: str) -> Clip | None:
        return self._by_key.get(piece_key(piece))

    @classmethod
    def load(cls, folder: Path) -> "ClipLibrary":
        """Un clip invalide est ignore avec un avertissement : il ne doit jamais empecher le serveur de demarrer."""
        manifest = folder / "manifest.json"
        if not manifest.exists():
            return cls()
        clips: dict[str, Clip] = {}
        for item in json.loads(manifest.read_text(encoding="utf-8")).get("clips", []):
            try:
                if not item.get("validated_by"):
                    continue  # pas valide par un locuteur : jamais servi
                path = (folder / item["file"]).resolve()
                if folder.resolve() not in path.parents:
                    raise ValueError("chemin hors du dossier")
                origin = item.get("origin", "recorded")
                if origin not in ("recorded", "synthetic"):
                    raise ValueError("origine inconnue")
                clip = Clip(item["id"], item["text"], _check_wav(path.read_bytes()), origin)
                key = piece_key(clip.text)
                if not key or SLOT_RE.search(clip.text) or re.search(r"\d", clip.text):
                    raise ValueError("le texte d'un clip ne contient ni balise ni chiffre")
                clips[key] = clip
            except Exception as exc:
                log.warning("clip %s ignore (%s)", item.get("id", "?"), type(exc).__name__)
        log.info("%d enregistrements valides charges", len(clips))
        return cls(clips)
