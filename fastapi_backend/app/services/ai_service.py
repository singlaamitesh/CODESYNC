"""
AI Service - Code Analysis, Optimization, and Suggestions
Uses OpenRouter API (Mistral Devstral) for AI capabilities
"""
import os
import json
import re
import httpx
from typing import List, Dict, Any, Optional
import hashlib
import logging

logger = logging.getLogger(__name__)

# OpenRouter Configuration — model is configurable via .env
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free')
OPENROUTER_URL = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')


class AIService:
    """AI Service for code analysis and suggestions"""
    
    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = OPENROUTER_MODEL
        self.ready = bool(self.api_key)
        
        if self.ready:
            logger.info(f"[AI] OpenRouter configured with model: {self.model}")
        else:
            logger.warning("[AI] WARNING: No OPENROUTER_API_KEY found in environment")
    
    async def call_openrouter(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1) -> Optional[str]:
        """Make async request to OpenRouter API"""
        if not self.ready:
            return None
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:8080',
            'X-Title': 'CodeSync AI'
        }
        
        data = {
            'model': self.model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': max_tokens,
            'temperature': temperature
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(OPENROUTER_URL, headers=headers, json=data)
                response.raise_for_status()
                result = response.json()
                return result['choices'][0]['message']['content']
        except Exception as e:
            logger.error(f"[AI] OpenRouter API error: {e}")
            return None
    
    async def call_openrouter_stream(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1):
        """Stream response from OpenRouter API — yields text chunks"""
        if not self.ready:
            return

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:8080',
            'X-Title': 'CodeSync AI'
        }

        data = {
            'model': self.model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': max_tokens,
            'temperature': temperature,
            'stream': True,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream('POST', OPENROUTER_URL, headers=headers, json=data) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.startswith('data: '):
                            chunk = line[6:]
                            if chunk == '[DONE]':
                                return
                            try:
                                parsed = json.loads(chunk)
                                delta = parsed['choices'][0].get('delta', {})
                                content = delta.get('content', '')
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
        except Exception as e:
            logger.error(f"[AI] OpenRouter stream error: {e}")

    def detect_language(self, code: str, filename: Optional[str] = None) -> str:
        """Detect programming language from filename or code content.
        For unknown extensions, returns the extension itself (without the dot)
        so the LLM can be told "treat this as a .po file" rather than guessing.
        """
        if filename:
            ext_map = {
                '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
                '.ts': 'typescript', '.tsx': 'typescript', '.cpp': 'cpp',
                '.c': 'c', '.h': 'cpp', '.java': 'java', '.html': 'html',
                '.css': 'css', '.scss': 'scss', '.sql': 'sql',
                '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
                '.sh': 'bash', '.zsh': 'bash', '.bash': 'bash',
                '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
                '.toml': 'toml', '.md': 'markdown', '.markdown': 'markdown',
                '.xml': 'xml', '.svg': 'xml',
                '.po': 'gettext-po', '.pot': 'gettext-po',
                '.dockerfile': 'dockerfile', '.tf': 'terraform',
                '.kt': 'kotlin', '.swift': 'swift', '.dart': 'dart',
                '.lua': 'lua', '.r': 'r', '.scala': 'scala',
                '.proto': 'protobuf', '.graphql': 'graphql', '.gql': 'graphql',
                '.env': 'dotenv', '.ini': 'ini', '.cfg': 'ini',
            }
            ext = os.path.splitext(filename.lower())[1]
            if ext in ext_map:
                return ext_map[ext]
            if ext:
                # Return the bare extension so the LLM gets accurate context
                # for unknown file types (e.g., proprietary or rare formats).
                return ext.lstrip('.')

        # Filename absent → fall back to content sniffing
        if 'def ' in code and ':' in code:
            return 'python'
        if 'function ' in code or 'const ' in code:
            return 'javascript'
        if '#include' in code:
            return 'cpp'
        if 'public class' in code:
            return 'java'
        if code.lstrip().startswith('msgid ') or 'msgstr ' in code:
            return 'gettext-po'
        return 'text'
    
    def safe_json_parse(self, text: str, default: Any = None) -> Any:
        """Safely parse JSON with fallback"""
        if not text:
            return default
        
        # Remove markdown code blocks
        text = text.strip()
        if text.startswith('```'):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        
        try:
            return json.loads(text)
        except:
            # Try to repair JSON
            text = text.rstrip().rstrip(',')
            open_braces = text.count('{') - text.count('}')
            open_brackets = text.count('[') - text.count(']')
            text += '}' * max(0, open_braces)
            text += ']' * max(0, open_brackets)
            text = re.sub(r',(\s*[}\]])', r'\1', text)
            
            try:
                return json.loads(text)
            except:
                return default
    
    async def analyze_code(self, code: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """Analyze code for errors and suggestions"""
        if not code or not code.strip():
            return self._empty_analysis()

        language = self.detect_language(code, filename)

        if not self.ready:
            return self._fallback_analysis(code, language)

        lines = code.split('\n')
        numbered_code = '\n'.join([f"{i+1}: {line}" for i, line in enumerate(lines)])

        # Special-case content that isn't program source code so the LLM doesn't
        # try to "fix" it as if it were Python or JS.
        non_code_langs = {'gettext-po', 'markdown', 'json', 'yaml', 'toml', 'ini',
                          'xml', 'dotenv', 'text'}
        is_code = language not in non_code_langs and not (filename and language not in non_code_langs and language == os.path.splitext(filename.lower())[1].lstrip('.'))
        intent = (
            f"Analyze this {language} source code. Find ALL bugs and report each with a fix."
            if is_code else
            f"This is a {language} file (filename: {filename or 'unknown'}). "
            f"Validate its structure/syntax and report ONLY actual problems. "
            f"Do NOT invent code suggestions if the content is non-executable."
        )

        prompt = f"""{intent}

CODE:
{numbered_code}

Return JSON with this EXACT format:
{{"suggestions": [{{"type": "error/warning/info", "message": "description", "line": 1, "severity": "error/warning/info", "fix": "corrected line"}}], "analysis": {{"lines": 10, "functions": 2, "classes": 1, "complexity_score": 75}}}}

The "fix" field MUST be the complete replacement for the line at the given line number — same indentation, same number of lines (or use \\n for multi-line). If you have no high-confidence fix, omit the "fix" field.
If the file has no problems return {{"suggestions": [], "analysis": {{"lines": {len(lines)}, "functions": 0, "classes": 0, "complexity_score": 100}}}}.
Return ONLY valid JSON, no markdown."""

        response_text = await self.call_openrouter(prompt, max_tokens=1500, temperature=0.1)
        
        if not response_text:
            return self._fallback_analysis(code, language)
        
        result = self.safe_json_parse(response_text, None)
        
        if result is None:
            return self._fallback_analysis(code, language)
        
        result['language'] = language
        result['llm_used'] = self.model
        result['analysis']['lines'] = len(lines)
        
        return result
    
    async def optimize_code(self, code: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """Optimize code for performance and readability"""
        if not code:
            return {"error": "No code provided"}
        
        language = self.detect_language(code, filename)
        
        if not self.ready:
            return {"error": "AI service not configured"}
        
        prompt = f"""Optimize this {language} code. Return ONLY JSON:

```{language}
{code}
```

JSON format: {{"optimized_code": "code here", "changes": [{{"description": "change", "impact": "performance/readability"}}], "summary": "summary text"}}"""

        response_text = await self.call_openrouter(prompt, max_tokens=4096, temperature=0.2)
        
        if not response_text:
            return {"error": "AI service failed"}
        
        result = self.safe_json_parse(response_text, None)
        
        if not result or 'optimized_code' not in result:
            return {"error": "Failed to parse optimization"}
        
        result['language'] = language
        result['llm_used'] = self.model
        
        return result
    
    async def get_completions(self, code: str, line: int, column: int, filename: Optional[str] = None) -> Dict[str, Any]:
        """Get code completions at cursor position"""
        if not code:
            return {"completions": [], "language": "text"}
        
        language = self.detect_language(code, filename)
        
        if not self.ready:
            return {"completions": [], "language": language}
        
        lines = code.split('\n')
        current_line = lines[line - 1] if line <= len(lines) else ""
        prefix = current_line[:column] if column <= len(current_line) else current_line
        
        prompt = f"""Provide code completions for {language} at cursor position.

Code:
```{language}
{code}
```

Current line: {current_line}
Cursor position: line {line}, column {column}
Prefix: "{prefix}"

Return JSON: {{"completions": [{{"label": "completion", "kind": "function/variable/keyword", "detail": "description"}}]}}"""

        response_text = await self.call_openrouter(prompt, max_tokens=1024, temperature=0.3)
        
        if not response_text:
            return {"completions": [], "language": language}
        
        result = self.safe_json_parse(response_text, {"completions": []})
        result['language'] = language
        
        return result
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector (simple hash-based for now)"""
        # Simple MD5-based embedding (in production, use proper embedding model)
        h = hashlib.md5(text.encode()).hexdigest()
        return [int(h[i:i+2], 16) / 255.0 for i in range(0, 32, 2)]
    
    async def search_similar(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Semantic search is disabled in the PocketBase deployment.
        Document storage lives in PocketBase and vector search is out of scope for v1.
        """
        return []
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            min_len = min(len(vec1), len(vec2))
            vec1, vec2 = vec1[:min_len], vec2[:min_len]
            
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            mag1 = sum(a * a for a in vec1) ** 0.5
            mag2 = sum(b * b for b in vec2) ** 0.5
            
            if mag1 == 0 or mag2 == 0:
                return 0.0
            
            return dot_product / (mag1 * mag2)
        except:
            return 0.0
    
    def _empty_analysis(self) -> Dict[str, Any]:
        """Empty analysis result"""
        return {
            "suggestions": [],
            "analysis": {
                "lines": 0,
                "functions": 0,
                "classes": 0,
                "complexity_score": 100
            },
            "language": "text",
            "llm_used": None
        }
    
    def _fallback_analysis(self, code: str, language: str) -> Dict[str, Any]:
        """Fallback rule-based analysis"""
        suggestions = []
        lines = code.split('\n')
        
        # Python-specific checks
        if language == 'python':
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.endswith(';') and not stripped.startswith('#'):
                    suggestions.append({
                        "type": "error",
                        "message": "Unnecessary semicolon in Python",
                        "line": i + 1,
                        "severity": "error",
                        "fix": line.rstrip().rstrip(';')
                    })
                if '//' in line and not line.strip().startswith('#'):
                    suggestions.append({
                        "type": "error",
                        "message": "Use # for comments in Python, not //",
                        "line": i + 1,
                        "severity": "error",
                        "fix": re.sub(r'\s*//\s*', '  # ', line.rstrip())
                    })
        
        return {
            "suggestions": suggestions,
            "analysis": {
                "lines": len(lines),
                "functions": 0,
                "classes": 0,
                "complexity_score": max(0, 100 - len(suggestions) * 20)
            },
            "language": language,
            "llm_used": "fallback"
        }
