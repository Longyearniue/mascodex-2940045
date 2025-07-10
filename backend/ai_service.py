import os
import asyncio
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from elevenlabs import generate, save, set_api_key
from config import settings
import logging

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self._openai_client: Optional[AsyncOpenAI] = None
        self._elevenlabs_initialized = False
        self._initialization_lock = asyncio.Lock()
    
    async def _initialize_openai(self):
        """Lazy initialization of OpenAI client"""
        if self._openai_client is None:
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            self._openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    
    def _initialize_elevenlabs(self):
        """Lazy initialization of ElevenLabs"""
        if not self._elevenlabs_initialized:
            if not settings.elevenlabs_api_key:
                raise ValueError("ElevenLabs API key not configured")
            set_api_key(settings.elevenlabs_api_key)
            self._elevenlabs_initialized = True
    
    async def generate_ceo_response(
        self, 
        user_message: str, 
        ceo_context: Dict[str, Any],
        conversation_history: list = None
    ) -> str:
        """Generate CEO-like response using OpenAI"""
        async with self._initialization_lock:
            await self._initialize_openai()
        
        # Build context for the AI
        context_parts = []
        
        # Add CEO profile information
        if ceo_context.get("name"):
            context_parts.append(f"あなたは{ceo_context['name']}です。")
        if ceo_context.get("company"):
            context_parts.append(f"会社: {ceo_context['company']}")
        if ceo_context.get("position"):
            context_parts.append(f"役職: {ceo_context['position']}")
        if ceo_context.get("bio"):
            context_parts.append(f"経歴: {ceo_context['bio']}")
        
        # Add documents context
        if ceo_context.get("documents"):
            doc_summaries = [doc.get("content_summary", "") for doc in ceo_context["documents"]]
            if doc_summaries:
                context_parts.append(f"会社資料: {' '.join(doc_summaries)}")
        
        # Add interview context
        if ceo_context.get("interviews"):
            interview_contents = [interview.get("content", "") for interview in ceo_context["interviews"]]
            if interview_contents:
                context_parts.append(f"過去のインタビュー: {' '.join(interview_contents)}")
        
        system_prompt = f"""
あなたはCEOとして、以下の情報に基づいて回答してください：

{' '.join(context_parts)}

指示：
1. CEOとしての威厳と経験を反映した回答をしてください
2. 会社のビジョンや戦略について話す際は、具体的で説得力のある内容にしてください
3. 質問に対しては、CEOとしての視点から回答してください
4. 日本語で自然な会話を心がけてください
5. 回答は簡潔で分かりやすくしてください
"""
        
        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            for msg in conversation_history[-10:]:  # Keep last 10 messages
                role = "user" if msg.get("message_type") == "user" else "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})
        
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = await self._openai_client.chat.completions.create(
                model="gpt-4",
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return "申し訳ございませんが、現在回答を生成できません。しばらく時間をおいてから再度お試しください。"
    
    def generate_voice(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> Optional[str]:
        """Generate voice using ElevenLabs"""
        try:
            self._initialize_elevenlabs()
            
            audio = generate(
                text=text,
                voice=voice_id,
                model="eleven_multilingual_v2"
            )
            
            # Save audio file
            filename = f"voice_{hash(text)}_{voice_id}.mp3"
            filepath = os.path.join(settings.upload_dir, "voices", filename)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            save(audio, filepath)
            
            return filepath
        
        except Exception as e:
            logger.error(f"ElevenLabs API error: {e}")
            return None
    
    async def process_document(self, file_path: str, file_type: str) -> str:
        """Process uploaded document and extract content"""
        try:
            content = ""
            
            if file_type == "pdf":
                import PyPDF2
                with open(file_path, "rb") as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page in pdf_reader.pages:
                        content += page.extract_text() + "\n"
            
            elif file_type == "docx":
                from docx import Document
                doc = Document(file_path)
                for paragraph in doc.paragraphs:
                    content += paragraph.text + "\n"
            
            elif file_type == "txt":
                with open(file_path, "r", encoding="utf-8") as file:
                    content = file.read()
            
            # Summarize content using OpenAI
            async with self._initialization_lock:
                await self._initialize_openai()
            
            summary_prompt = f"""
以下の会社資料の内容を要約してください：

{content[:3000]}  # Limit to first 3000 characters

要約のポイント：
1. 会社の主要な事業内容
2. 重要な戦略や方針
3. 組織構造や役職に関する情報
4. その他の重要な情報

要約は200文字以内で簡潔にまとめてください。
"""
            
            response = await self._openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "あなたは会社資料の要約専門家です。"},
                    {"role": "user", "content": summary_prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            logger.error(f"Document processing error: {e}")
            return "文書の処理中にエラーが発生しました。"


# Global AI service instance
ai_service = AIService()