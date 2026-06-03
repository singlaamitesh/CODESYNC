"""
Language detection helpers.

Used by the pipeline's "prepare" stage to give the LLM accurate context about
what kind of file it is looking at.
"""
import os
from typing import Optional

# Map file extension -> language id understood by the LLM / syntax highlighters.
_EXT_MAP = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".cpp": "cpp",
    ".c": "c", ".h": "cpp", ".java": "java", ".html": "html",
    ".css": "css", ".scss": "scss", ".sql": "sql",
    ".go": "go", ".rs": "rust", ".rb": "ruby", ".php": "php",
    ".sh": "bash", ".zsh": "bash", ".bash": "bash",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml", ".md": "markdown", ".markdown": "markdown",
    ".xml": "xml", ".svg": "xml",
    ".po": "gettext-po", ".pot": "gettext-po",
    ".dockerfile": "dockerfile", ".tf": "terraform",
    ".kt": "kotlin", ".swift": "swift", ".dart": "dart",
    ".lua": "lua", ".r": "r", ".scala": "scala",
    ".proto": "protobuf", ".graphql": "graphql", ".gql": "graphql",
    ".env": "dotenv", ".ini": "ini", ".cfg": "ini",
}

# Languages that are data/markup rather than executable source code. The
# pipeline uses this to avoid asking the LLM to "fix bugs" in a JSON or .po file.
NON_CODE_LANGUAGES = {
    "gettext-po", "markdown", "json", "yaml", "toml", "ini",
    "xml", "dotenv", "text",
}


def detect_language(code: str, filename: Optional[str] = None) -> str:
    """Best-effort language id from the filename, falling back to content sniffing.

    For a known extension we return its mapped language. For an unknown
    extension we return the bare extension (e.g. "po") so the LLM still gets
    accurate context. With no filename we sniff the content heuristically.
    """
    if filename:
        ext = os.path.splitext(filename.lower())[1]
        if ext in _EXT_MAP:
            return _EXT_MAP[ext]
        if ext:
            return ext.lstrip(".")

    # No usable filename -> guess from the code itself.
    if "def " in code and ":" in code:
        return "python"
    if "function " in code or "const " in code:
        return "javascript"
    if "#include" in code:
        return "cpp"
    if "public class" in code:
        return "java"
    if code.lstrip().startswith("msgid ") or "msgstr " in code:
        return "gettext-po"
    return "text"


def is_executable_code(language: str) -> bool:
    """True when `language` is real source code (not data/markup)."""
    return language not in NON_CODE_LANGUAGES
