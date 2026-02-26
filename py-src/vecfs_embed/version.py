"""Single source of version for VecFS Python packages. Version is baked in at build time from VERSION.txt via pyproject.toml; runtime reads only from package metadata."""


def get_version() -> str:
    try:
        from importlib.metadata import version
        return version("vecfs-embed")
    except Exception:
        return "0.0.0.dev"
