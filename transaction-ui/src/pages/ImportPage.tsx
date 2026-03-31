import React, { useEffect, useRef, useState } from 'react';
import { ImportResultDto, OwnerDto } from '../ApiModel';
import { API_BASE } from '../config';

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';
type SourceType = 'bcr' | 'revolut';

function ImportPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [source, setSource] = useState<SourceType>('bcr');
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [result, setResult] = useState<ImportResultDto | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Revolut-specific state
    const [owners, setOwners] = useState<OwnerDto[]>([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
    const [importReverted, setImportReverted] = useState<boolean>(false);
    const [ownersLoading, setOwnersLoading] = useState<boolean>(false);

    // Fetch owners when Revolut source is selected
    useEffect(() => {
        if (source !== 'revolut') return;
        setOwnersLoading(true);
        fetch(`${API_BASE}/owners`)
            .then(r => r.json())
            .then((data: OwnerDto[]) => {
                setOwners(data);
                if (data.length > 0) setSelectedOwnerId(String(data[0].id));
            })
            .catch(() => setOwners([]))
            .finally(() => setOwnersLoading(false));
    }, [source]);

    function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>): void {
        setSource(e.target.value as SourceType);
        setResult(null);
        setErrorMsg('');
        setStatus('idle');
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleImport(): Promise<void> {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setErrorMsg(`Please select a ${source === 'bcr' ? 'JSON' : 'CSV'} file first.`);
            setStatus('error');
            return;
        }

        if (source === 'revolut' && !selectedOwnerId) {
            setErrorMsg('Please select an owner for the Revolut import.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setResult(null);
        setErrorMsg('');

        const formData = new FormData();
        formData.append('file', file);

        let url: string;
        if (source === 'revolut') {
            formData.append('ownerId', selectedOwnerId);
            formData.append('importReverted', String(importReverted));
            url = `${API_BASE}/import/revolut`;
        } else {
            url = `${API_BASE}/import/bcr`;
        }

        try {
            const response = await fetch(url, { method: 'POST', body: formData });

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
                <select id="source-type" value={source} onChange={handleSourceChange}>
                    <option value="bcr">BCR (JSON)</option>
                    <option value="revolut">Revolut (CSV)</option>
                </select>

                <label htmlFor="file-input">File</label>
                <input
                    id="file-input"
                    type="file"
                    accept={source === 'revolut' ? '.csv' : '.json'}
                    ref={fileInputRef}
                />

                {source === 'revolut' && (
                    <>
                        <label htmlFor="owner-select">Owner</label>
                        {ownersLoading ? (
                            <span>Loading owners…</span>
                        ) : owners.length === 0 ? (
                            <span className="error-msg">No owners found in the database.</span>
                        ) : (
                            <select
                                id="owner-select"
                                value={selectedOwnerId}
                                onChange={e => setSelectedOwnerId(e.target.value)}
                            >
                                {owners.map(o => (
                                    <option key={o.id} value={String(o.id)}>
                                        {o.account_title ?? o.account_number ?? `Owner #${o.id}`}
                                    </option>
                                ))}
                            </select>
                        )}

                        <label htmlFor="import-reverted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                id="import-reverted"
                                type="checkbox"
                                checked={importReverted}
                                onChange={e => setImportReverted(e.target.checked)}
                            />
                            Import reverted transactions
                        </label>
                    </>
                )}

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
                    {result.reportFile && (
                        <>
                            {' — '}
                            <a
                                href={`${API_BASE}/import/reports/${encodeURIComponent(result.reportFile)}`}
                                download={result.reportFile}
                            >
                                Download skip report
                            </a>
                        </>
                    )}
                </div>
            )}
            {status === 'error' && (
                <div className="error-msg">{errorMsg}</div>
            )}
        </div>
    );
}

export default ImportPage;
