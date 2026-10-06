"""Packaging: requirements files stay in sync with pyproject (Docker layer cache)."""

import tomllib
from pathlib import Path

ROOT = Path(__file__).parent.parent


def _pyproject():
    return tomllib.loads((ROOT / "pyproject.toml").read_text())


def _req_names(path: str) -> set[str]:
    names = set()
    for line in (ROOT / path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "-")):
            continue
        names.add(line.split(">")[0].split("=")[0].split("<")[0].strip().lower())
    return names


def test_requirements_match_base_deps():
    deps = _pyproject()["project"]["dependencies"]
    base = {d.split(">")[0].split("=")[0].split("<")[0].strip().lower() for d in deps}
    assert _req_names("requirements.txt") == base


def test_requirements_ml_match_extra():
    extra = _pyproject()["project"]["optional-dependencies"]["ml"]
    ml = {d.split(">")[0].split("=")[0].split("<")[0].strip().lower() for d in extra}
    assert _req_names("requirements-ml.txt") == ml
