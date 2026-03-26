import React, { useRef, useState } from 'react';
import { ImportResultDto } from '../ApiModel';
import { API_BASE } from '../config';

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

function ImportPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [result, setResult] = useState<ImportResultDto | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');

    async function handleImport(): Promise<void> {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setErrorMsg('Please select a JSON file first.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setResult(null);
        setErrorMsg('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/import/bcr`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Server error ${response.status}`);
            }

            const data: ImportResultDto = await response.json();
            setResult(data);
            setStatus('success');
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }

    return (
        <div className="page">
            <h2>Import</h2>
            <div className="import-form">
                <label htmlFor="source-type">Source</label>
                <select id="source-type" defaultValue="bcr">
                    <option value="bcr">BCR (JSON)</option>
                </select>

                <label htmlFor="file-input">File</label>
                <input
                    id="file-input"
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                />

                <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={status === 'loading'}
                >
                    {status === 'loading' ? 'Importing…' : 'Import'}
                </button>
            </div>

            {status === 'success' && result && (
                <div className="import-result success-msg">
                    Import complete — imported: <strong>{result.imported}</strong>, skipped: <strong>{result.skipped}</strong>
                </div>
            )}
            {status === 'error' && (
                <div className="error-msg">{errorMsg}</div>
            )}
        </div>
    );
}

export default ImportPage;
