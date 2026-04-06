import asyncio
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Union


class LLMInterface(ABC):
    """Generic interface for LLM interactions."""

    @abstractmethod
    async def generate(self, prompt: str, model: str, response_format: str = "text", web_search: bool = False) -> str:
        pass


class GeminiLLM(LLMInterface):
    """Gemini-specific implementation of LLMInterface."""

    def __init__(self, api_key: str):
        try:
            from google import genai
            self.client = genai.Client(api_key=api_key)
            self.genai_types = genai.types
        except ImportError:
            raise ImportError("google-genai package is required for GeminiLLM")

    async def generate(self, prompt: str, model: str, response_format: str = "text", web_search: bool = False) -> str:
        config = {}

        if response_format == "json":
            config['response_mime_type'] = 'application/json'
        else:
            config['response_mime_type'] = 'text/plain'

        if web_search:
            config['tools'] = [self.genai_types.Tool(google_search=self.genai_types.GoogleSearch())]

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=model,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini generation failed: {str(e)}")


class LLMFactory:
    """Factory to create LLM instances."""

    @staticmethod
    def create_llm(api_key: str, provider: str = "gemini") -> LLMInterface:
        if provider.lower() == "gemini":
            return GeminiLLM(api_key)
        raise ValueError(f"Unsupported LLM provider: {provider}")