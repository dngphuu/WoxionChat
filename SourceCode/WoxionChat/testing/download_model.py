#!/usr/bin/env python3
"""
Script tải trước mô hình BAAI/bge-m3 với cấu hình ổn định.
Tự động kích hoạt HF_HUB_DISABLE_XET=1 để tránh lỗi treo mạng và DNS.
"""
import os
import sys

# Tắt hf-xet để dùng HTTP chunked download ổn định
os.environ["HF_HUB_DISABLE_XET"] = "1"

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

print("=" * 60)
print("🚀 Bắt đầu tải và kiểm tra mô hình: BAAI/bge-m3 (~2.27 GB)")
print("ℹ️  Quá trình này sẽ lưu vào ~/.cache/huggingface/hub/ và chỉ tải 1 lần duy nhất.")
print("=" * 60)

try:
    from sentence_transformers import SentenceTransformer
    import torch
    
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
        
    print(f"🖥️  Thiết bị sử dụng: {device}")
    model = SentenceTransformer("BAAI/bge-m3", device=device)
    print("✅ Tải và nạp mô hình BAAI/bge-m3 thành công!")
    
    # Kiểm tra thử nghiệm encoding
    test_emb = model.encode("Kiểm tra thử nghiệm embedding BGE-M3", normalize_embeddings=True)
    print(f"🎉 Kiểm tra embedding thành công! Chiều dài vector: {len(test_emb)} (kỳ vọng: 1024)")
    sys.exit(0)
except Exception as e:
    print(f"❌ Lỗi khi tải mô hình: {e}")
    sys.exit(1)
