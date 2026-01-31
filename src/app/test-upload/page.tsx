
"use client";

import { useState } from "react";
import { Loader2, UploadCloud, FileIcon, CheckCircle, AlertTriangle } from "lucide-react";

export default function TestUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/google-drive-upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-stone-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <UploadCloud size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-stone-800">Test Upload Google Drive</h1>
                        <p className="text-xs text-stone-500">Service Account Integration</p>
                    </div>
                </div>

                {/* Dropzone / Input */}
                <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 hover:bg-stone-50 transition-colors text-center relative">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                        <div className="bg-stone-100 p-3 rounded-full text-stone-400">
                            <UploadCloud size={24} />
                        </div>
                        <p className="text-sm font-medium text-stone-600">
                            {file ? file.name : "Click hoặc kéo thả file vào đây"}
                        </p>
                        <p className="text-xs text-stone-400">
                            {file ? `${(file.size / 1024).toFixed(2)} KB` : "Hỗ trợ mọi định dạng"}
                        </p>
                    </div>
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className={`w-full mt-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${!file || uploading ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}
                    `}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Đang tải lên...
                        </>
                    ) : (
                        <>
                            <UploadCloud size={16} />
                            Tải lên ngay
                        </>
                    )}
                </button>

                {/* Result Section */}
                {result && (
                    <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-100 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2 text-green-700 font-bold text-sm">
                            <CheckCircle size={16} />
                            Upload thành công!
                        </div>
                        <div className="space-y-2 text-xs text-stone-600">
                            <div className="flex justify-between">
                                <span className="text-stone-400">ID:</span>
                                <span className="font-mono bg-white px-1 rounded border border-green-100">{result.fileId}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-stone-400">Link:</span>
                                <a href={result.webViewLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                                    Mở file
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Section */}
                {error && (
                    <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-1 text-red-700 font-bold text-sm">
                            <AlertTriangle size={16} />
                            Đã có lỗi xảy ra
                        </div>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
