import os
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional
from django.conf import settings
from .models import UploadedFile, OCRResultFactory
from accounts.models import User
import io
import logging
import re
import docx
from io import BytesIO
import asyncio
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class GeminiAI:
    """Gemini AI client wrapper with fallback and async support"""
    def __init__(self, api_key: str, model_name: Optional[str] = None):
        self.api_key = api_key
        self.model_name = model_name or getattr(settings, 'GEMINI_OCR_MODEL', 'gemini-3.5-flash')
        self.fallback_model = "gemini-3.5-flash-lite"
        self.client = genai.Client(api_key=api_key)

    async def generate_content_async(self, contents, **kwargs) -> str:
        """Call Gemini asynchronously with fallback if the primary model is busy or unavailable."""
        models_to_try = [self.model_name]
        if self.fallback_model not in models_to_try:
            models_to_try.append(self.fallback_model)

        last_error = None
        for m in models_to_try:
            try:
                logger.info(f"Generating content with Gemini model: {m} ...")
                response = await self.client.aio.models.generate_content(
                    model=m,
                    contents=contents,
                    **kwargs
                )
                if response and response.text:
                    return response.text
                return ""
            except Exception as e:
                logger.warning(f"Gemini model {m} failed: {e}. Trying fallback if available...")
                last_error = e

        if last_error:
            raise last_error
        return ""


class MistralAI:
    """Backward compatibility wrapper for MistralAI"""
    def __init__(self, mistral_api_key):
        self.api_key = mistral_api_key
        try:
            from mistralai import Mistral
            self.mistral_client = Mistral(api_key=mistral_api_key)
        except Exception:
            self.mistral_client = None

    @property
    def chat(self):
        return self.mistral_client.chat if self.mistral_client else None


class FileUploadService:
    @staticmethod
    def upload_file(user: User, title: str, file_obj) -> UploadedFile:
        try:
            validation_result = FileUploadService._validate_file(file_obj)
            if not validation_result['is_valid']:
                logger.error(f"File validation failed: {validation_result['errors']}")
                raise ValueError('; '.join(validation_result['errors']))
            if not title or not title.strip():
                title = FileUploadService._generate_title_from_filename(file_obj.name)

            uploaded_file = UploadedFile(title=title.strip())
            uploaded_file.set_uploader(user)
            uploaded_file.file.put(file_obj, filename=file_obj.name)
  
            # Save to database
            logger.info("Starting database save...")
            uploaded_file.save()

            gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None)
            mistral_api_key = getattr(settings, 'MISTRAL_API_KEY', None)
            api_key = gemini_api_key or mistral_api_key

            if api_key:
                try:
                    OCRProcessingService.Processing_with_gemini(uploaded_file, api_key)
                    logger.info(f"OCR processing started for file {uploaded_file.id}")
                except Exception as e:
                    logger.warning(f"OCR processing failed for file {uploaded_file.id}: {e}")
            else:
                logger.warning("No OCR API key found, creating basic OCR task")
                OCRProcessingService.create_ocr_task(uploaded_file)
            
            return uploaded_file
            
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            raise
    
    @staticmethod
    def delete_file(uploaded_file: UploadedFile):
        try:
            file_id = uploaded_file.id
            uploaded_file.delete()
            logger.info(f"File deleted successfully: {file_id}")
        except Exception as e:
            logger.error(f"Error deleting file {uploaded_file.id}: {e}")
            raise
    
    @staticmethod
    def _validate_file(file_obj) -> Dict[str, Any]:
        errors = []
        warnings = []
        
        ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.png', '.jpg', '.jpeg', '.txt', '.webp', '.bmp']
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        
        # Check extension
        if hasattr(file_obj, 'name') and file_obj.name:
            ext = os.path.splitext(file_obj.name)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                errors.append(f"File extension '{ext}' not allowed")
        else:
            errors.append("Invalid filename")
        
        # Check file size
        if hasattr(file_obj, 'size') and file_obj.size:
            if file_obj.size > MAX_FILE_SIZE:
                errors.append(f"File too large: {file_obj.size:,} bytes")
        else:
            errors.append("Cannot determine file size")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    @staticmethod
    def _generate_title_from_filename(filename: str) -> str:
        if not filename:
            return "Untitled Document"
        
        name_without_ext = os.path.splitext(filename)[0]
        title = name_without_ext.replace('_', ' ').replace('-', ' ')
        title = ' '.join(word.capitalize() for word in title.split())
        return title[:100] + "..." if len(title) > 100 else title
    
    @staticmethod
    def get_user_files(user: User, limit: int = None) -> List[UploadedFile]:
        queryset = UploadedFile.objects(uploader_id=str(user.id)).order_by('-uploaded_at')
        if limit:
            queryset = queryset[:limit]
        return list(queryset)


class OCRProcessingService:
    """Service xử lý OCR với Google Gemini API - PURE STATIC METHODS"""
    @staticmethod
    def create_ocr_task(uploaded_file: UploadedFile):
        """Tạo OCR task cho file - Sử dụng OCRResultFactory"""
        logger.info("Creating ocr task ...")
        ocr_result = OCRResultFactory.create_ocr_result(uploaded_file)
        ocr_result.save()
        return ocr_result
    
    @staticmethod
    def Processing_with_gemini(uploaded_file: UploadedFile, gemini_api_key: Optional[str] = None):
        """Process OCR with Google Gemini API"""
        logger.info("Processing with Gemini API ...")
        api_key = gemini_api_key or getattr(settings, 'GEMINI_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None)
        if not api_key:
            raise ValueError("GEMINI_API_KEY / GOOGLE_API_KEY is not configured")

        ocr_result = OCRResultFactory.create_ocr_result(uploaded_file)
        ocr_result.save()
        ocr_result.mark_as_processing()
        
        try:
            # Run async processing in sync context
            result = asyncio.run(OCRProcessingService._process_file_async(uploaded_file, api_key))
            
            # Lưu kết quả
            ocr_result.mark_as_success(
                result_data=result,
                raw_markdown=result.get('markdown_content', '')
            )
            logger.info(f"Successfully processed OCR with Gemini for file {uploaded_file.id}")
        except Exception as e:
            logger.error(f"Error processing file {uploaded_file.id} with Gemini: {e}")
            ocr_result.mark_as_failed(str(e))
            raise
        
        return ocr_result

    @staticmethod
    def Processing_with_mistral(uploaded_file: UploadedFile, mistral_api_key: str):
        """Backward compatibility alias: routes to Gemini OCR"""
        gemini_key = getattr(settings, 'GEMINI_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None) or mistral_api_key
        return OCRProcessingService.Processing_with_gemini(uploaded_file, gemini_key)

    @staticmethod
    async def _process_file_async(uploaded_file: UploadedFile, api_key: str) -> Dict[str, Any]:
        logger.info("Process file async with Gemini ...")
        gemini_client = GeminiAI(api_key)
        
        # Lấy file content từ GridFS
        file_content = uploaded_file.file.read()
        file_extension = uploaded_file.extension.lower()
        filename = uploaded_file.filename
        
        if file_extension in ['.png', '.jpg', '.jpeg', '.webp', '.bmp']:
            result = await OCRProcessingService._process_image_with_gemini_async(
                gemini_client, file_content, filename
            )
        elif file_extension == '.pdf':
            result = await OCRProcessingService._process_pdf_with_gemini_async(
                gemini_client, file_content, filename
            )
        elif file_extension == '.docx':
            result = await OCRProcessingService._process_docx_with_gemini_async(
                gemini_client, file_content, filename
            )
        elif file_extension == '.txt':
            result = await OCRProcessingService._process_text_with_gemini_async(
                gemini_client, file_content, filename
            )
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        return result

    @staticmethod
    async def _process_image_with_gemini_async(gemini_client: GeminiAI, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Async processing of image files using Gemini multimodal"""
        logger.info(f"Processing image with Gemini: {filename}")
        ext = os.path.splitext(filename)[1].lower()
        mime_map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp'
        }
        mime_type = mime_map.get(ext, 'image/jpeg')
        
        part = types.Part.from_bytes(data=file_content, mime_type=mime_type)
        prompt = (
            "Hãy trích xuất tất cả văn bản từ hình ảnh này và định dạng thành markdown có cấu trúc rõ ràng. "
            "Bao gồm bảng, tiêu đề, danh sách và giữ nguyên cấu trúc tài liệu. "
            "Nếu văn bản là tiếng Việt thì giữ nguyên tiếng Việt, giữ nguyên ngôn ngữ gốc của tài liệu."
        )
        
        markdown_content = await gemini_client.generate_content_async(
            contents=[part, prompt]
        )
        
        return {
            "file_type": "image",
            "filename": filename,
            "markdown_content": markdown_content,
            "structured_content": {
                "type": "image_ocr_gemini",
                "processing_model": gemini_client.model_name
            }
        }

    @staticmethod
    async def _process_pdf_with_gemini_async(gemini_client: GeminiAI, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Async processing of PDF files using Gemini native document support"""
        logger.info(f"Processing PDF with Gemini: {filename}")
        page_count = OCRProcessingService._get_pdf_page_count(file_content)
        
        part = types.Part.from_bytes(data=file_content, mime_type="application/pdf")
        prompt = (
            "Hãy trích xuất toàn bộ văn bản và nội dung từ tài liệu PDF này và định dạng thành markdown có cấu trúc rõ ràng, chuyên nghiệp. "
            "Bao gồm tất cả các tiêu đề, bảng biểu, danh sách và giữ nguyên cấu trúc phân cấp tài liệu. "
            "Nếu tài liệu có nhiều trang, hãy phân tách bằng dấu phân cách hoặc tiêu đề trang rõ ràng. "
            "Giữ nguyên ngôn ngữ gốc của tài liệu."
        )
        
        markdown_content = await gemini_client.generate_content_async(
            contents=[part, prompt]
        )
        
        return {
            "file_type": "pdf",
            "filename": filename,
            "markdown_content": markdown_content,
            "structured_content": {
                "type": "pdf_ocr_gemini",
                "pages_processed": page_count,
                "processing_model": gemini_client.model_name
            }
        }

    @staticmethod
    async def _process_text_with_gemini_async(gemini_client: GeminiAI, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Async processing of text files with Gemini formatting"""
        logger.info(f"Processing text file with Gemini: {filename}")
        try:
            text_content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                text_content = file_content.decode('latin-1')
            except Exception:
                text_content = file_content.decode('utf-8', errors='ignore')

        prompt = (
            "Hãy định dạng nội dung văn bản này thành markdown có cấu trúc với tiêu đề, danh sách và formatting phù hợp "
            "để cải thiện khả năng đọc nhưng vẫn giữ nguyên toàn bộ nội dung gốc. Giữ nguyên ngôn ngữ gốc:\n\n"
            + text_content
        )
        
        markdown_content = await gemini_client.generate_content_async(
            contents=prompt
        )
        
        return {
            "file_type": "text",
            "filename": filename,
            "markdown_content": markdown_content,
            "structured_content": {
                "type": "text_formatting_gemini",
                "processing_model": gemini_client.model_name
            }
        }

    @staticmethod
    async def _process_docx_with_gemini_async(gemini_client: GeminiAI, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Async processing of DOCX files with Gemini formatting"""
        logger.info(f"Processing DOCX file with Gemini: {filename}")
        doc_stream = BytesIO(file_content)
        doc = docx.Document(doc_stream)
        
        text_content = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_content.append(paragraph.text)
        
        for table in doc.tables:
            for row in table.rows:
                row_text = []
                for cell in row.cells:
                    if cell.text.strip():
                        row_text.append(cell.text.strip())
                if row_text:
                    text_content.append(" | ".join(row_text))
        
        full_text = "\n\n".join(text_content)
        if not full_text.strip():
            raise ValueError("No text content found in DOCX file")

        prompt = (
            "Hãy định dạng nội dung DOCX này thành markdown có cấu trúc với tiêu đề, danh sách, bảng và formatting phù hợp. "
            "Giữ nguyên toàn bộ nội dung và ngôn ngữ gốc:\n\n" + full_text
        )
        
        markdown_content = await gemini_client.generate_content_async(
            contents=prompt
        )
        
        return {
            "file_type": "docx",
            "filename": filename,
            "markdown_content": markdown_content,
            "structured_content": {
                "type": "docx_formatting_gemini",
                "processing_model": gemini_client.model_name
            }
        }

    @staticmethod
    def get_processing_status(ocr_result_id: str) -> Dict[str, Any]:
        """Lấy trạng thái OCR - Tìm trong cả admin_database và user_database"""
        logger.info("Get processing status ...")
        from .models import AdminOCRResult, UserOCRResult, OCRResult
        
        ocr_result = None
        
        # Check admin database
        ocr_result = AdminOCRResult.objects(id=ocr_result_id).first()
        if not ocr_result:
            # Check user database  
            ocr_result = UserOCRResult.objects(id=ocr_result_id).first()
        if not ocr_result:
            # Fallback to legacy collection
            ocr_result = OCRResult.objects(id=ocr_result_id).first()
        
        if not ocr_result:
            raise ValueError(f"OCR result with ID {ocr_result_id} not found")
        
        return {
            "id": str(ocr_result.id),
            "status": ocr_result.status,
            "is_completed": ocr_result.is_completed,
            "is_successful": ocr_result.is_successful,
            "error_message": ocr_result.error_message,
            "created_at": ocr_result.created_at.isoformat() if ocr_result.created_at else None,
            "completed_at": ocr_result.completed_at.isoformat() if ocr_result.completed_at else None,
            "collection": ocr_result._meta.get('collection', 'unknown')
        }

    @staticmethod
    def _get_pdf_page_count(file_content: bytes) -> int:
        """Get the number of pages in a PDF file"""
        logger.info("counting page ...")
        try:
            # Try using pdfplumber first
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                    return len(pdf.pages)
            except ImportError:
                pass
            
            # Fallback to PyPDF2
            try:
                import PyPDF2
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                return len(pdf_reader.pages)
            except ImportError:
                pass
            
            return 0
            
        except Exception as e:
            logger.warning(f"Could not determine PDF page count: {e}")
            return 0
