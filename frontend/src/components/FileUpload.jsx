import { FileText, Image, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { API_BASE_URL, getApiErrorMessage, uploadFiles } from "../lib/api";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

export default function FileUpload({ uploadedFiles, onChange, onBack, onContinue }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      setError("");
      if (rejectedFiles.length) {
        setError("Desteklenmeyen format veya 10 MB üzeri dosya var.");
        return;
      }
      if (uploadedFiles.length + acceptedFiles.length > MAX_FILES) {
        setError(`En fazla ${MAX_FILES} dosya yüklenebilir.`);
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadFiles(acceptedFiles);
        onChange([...uploadedFiles, ...result.files]);
      } catch (err) {
        setError(getApiErrorMessage(err, "Dosyalar yüklenemedi."));
      } finally {
        setIsUploading(false);
      }
    },
    [onChange, uploadedFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic", ".heif"],
      "application/pdf": [".pdf"],
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dosya Yükleme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          {...getRootProps()}
          className={[
            "flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            isDragActive ? "border-primary bg-teal-50" : "border-border bg-white dark:bg-slate-900",
          ].join(" ")}
        >
          <input {...getInputProps()} />
          {isUploading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
          <p className="text-sm font-medium">JPG, PNG, WEBP, HEIC veya PDF</p>
          <p className="mt-1 text-xs text-muted-foreground">10 MB/dosya, toplam 5 dosya</p>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {uploadedFiles.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {uploadedFiles.map((file) => (
              <div key={file.file_id} className="flex items-center gap-3 rounded-md border border-border bg-white p-3 dark:bg-slate-900">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {file.type === "image" && file.preview_url ? (
                    <img src={`${API_BASE_URL}${file.preview_url}`} alt="" className="h-full w-full object-cover" />
                  ) : file.type === "pdf" ? (
                    <FileText className="h-6 w-6 text-primary" />
                  ) : (
                    <Image className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(file.size_bytes / 1024)} KB</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(uploadedFiles.filter((item) => item.file_id !== file.file_id))}
                  aria-label="Dosyayı kaldır"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Geri
          </Button>
          <Button type="button" onClick={onContinue} disabled={isUploading}>
            {uploadedFiles.length ? "Analizi başlat" : "Atlayarak devam et"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
