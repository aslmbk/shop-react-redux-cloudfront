import React from "react";
import axios from "axios";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

type CSVFileImportProps = {
  url: string;
  title: string;
};

export default function CSVFileImport({ url, title }: CSVFileImportProps) {
  const [file, setFile] = React.useState<File>();
  const [isUploading, setIsUploading] = React.useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const removeFile = () => {
    setFile(undefined);
  };

  const uploadFile = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const { data: signedUrl } = await axios.get<string>(url, {
        params: { name: file.name },
      });
      const result = await fetch(signedUrl, { method: "PUT", body: file });
      if (!result.ok) {
        throw new Error(
          `S3 upload failed: ${result.status} ${result.statusText}`,
        );
      }
      setFile(undefined);
      alert(`File "${file.name}" uploaded successfully.`);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.statusText ?? err.message)
        : err instanceof Error
          ? err.message
          : "Unknown error";
      alert(`Failed to upload "${file.name}": ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {!file ? (
        <input type="file" accept=".csv" onChange={onFileChange} />
      ) : (
        <Box display="flex" gap={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={removeFile}
            disabled={isUploading}
          >
            Remove file
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={uploadFile}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload file"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
