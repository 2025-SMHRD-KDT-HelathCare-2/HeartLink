from dotenv import load_dotenv
import os

# .env 로드
load_dotenv()

# 환경변수
MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MCP_URL = os.getenv("MCP_URL", "http://localhost:3001/mcp")
GOOGLE_TTS_API_KEY = os.getenv("GOOGLE_CLOUD_TTS_KEY")