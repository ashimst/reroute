"""
Unified LLM Provider Factory for Retail Flow BYOK (Bring Your Own Key).
Supports Groq LPU, OpenAI, Anthropic, and local Ollama inference.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx

from src.config import GROQ_API_KEY, GROQ_MODEL

log = logging.getLogger(__name__)

class LLMProviderFactory:
    @staticmethod
    async def generate_completion(
        messages: List[Dict[str, str]],
        provider: str = "groq",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 600,
    ) -> Dict[str, Any]:
        """
        Execute completion with the requested provider and custom key.
        Returns {"content": str, "provider": str, "model": str}
        """
        prov = (provider or "groq").lower().strip()

        # 1. Groq LPU Provider
        if prov == "groq":
            key = (api_key or "").strip() or GROQ_API_KEY
            selected_model = model or GROQ_MODEL or "llama-3.3-70b-versatile"
            if not key:
                return {
                    "content": "Simulated resolution: policy verified. (No Groq API key configured).",
                    "provider": "groq_simulated",
                    "model": selected_model,
                }
            
            try:
                from groq import Groq
                client = Groq(api_key=key)
                resp = client.chat.completions.create(
                    model=selected_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return {
                    "content": resp.choices[0].message.content or "",
                    "provider": "groq",
                    "model": selected_model,
                }
            except Exception as e:
                log.error(f"[ProviderFactory] Groq failed: {e}")
                raise e

        # 2. OpenAI Provider (GPT-4o, GPT-4o-mini)
        elif prov == "openai":
            key = (api_key or os.getenv("OPENAI_API_KEY", "")).strip()
            selected_model = model or "gpt-4o-mini"
            if not key:
                raise ValueError("OpenAI API key is missing. Please provide your API key.")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": selected_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "content": data["choices"][0]["message"]["content"],
                    "provider": "openai",
                    "model": selected_model,
                }

        # 3. Anthropic Provider (Claude 3.5 Sonnet)
        elif prov == "anthropic":
            key = (api_key or os.getenv("ANTHROPIC_API_KEY", "")).strip()
            selected_model = model or "claude-3-5-sonnet-20241022"
            if not key:
                raise ValueError("Anthropic API key is missing. Please provide your API key.")
            
            # Format system message vs user messages for Anthropic
            system_msg = ""
            user_messages = []
            for m in messages:
                if m.get("role") == "system":
                    system_msg = m.get("content", "")
                else:
                    user_messages.append({"role": m.get("role"), "content": m.get("content")})
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": selected_model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_msg,
                    "messages": user_messages,
                }
                resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = "".join(b.get("text", "") for b in data.get("content", []))
                return {
                    "content": content,
                    "provider": "anthropic",
                    "model": selected_model,
                }

        # 4. Ollama (Local / Self-Hosted)
        elif prov == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
            selected_model = model or "llama3.2"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                payload = {
                    "model": selected_model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                }
                resp = await client.post(f"{base_url}/api/chat", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "content": data.get("message", {}).get("content", ""),
                    "provider": "ollama",
                    "model": selected_model,
                }

        else:
            raise ValueError(f"Unsupported LLM provider: {prov}")
