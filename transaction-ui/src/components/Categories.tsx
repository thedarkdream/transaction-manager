import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

export interface Node {
    id: number;
    parent: number | null;
    name: string;
    index: number;
    color: string | null;
    children?: Node[];
}

export interface CategoryCallbacks {
    onAdd: (parentId: number | null, name: string) => void;
    onRename: (id: number, name: string) => void;
    onDelete: (id: number) => void;
    onSwap: (id1: number, id2: number) => void;
    onColorChange: (id: number, color: string) => void;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function PencilIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
    );
}

function AddChildIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    );
}

function DragHandleIcon() {
    return (
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true" style={{ opacity: 0.35 }}>
            <circle cx="4" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
        </svg>
    );
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

interface TreeNodeProps {
    node: Node;
    callbacks: CategoryCallbacks;
    isDragging: boolean;
    isDragTarget: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
}

function TreeNode({ node, callbacks, isDragging, isDragTarget, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }: TreeNodeProps) {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const [addingChild, setAddingChild] = useState(false);
    const [newChildName, setNewChildName] = useState('');
    const [localColor, setLocalColor] = useState(node.color ?? '#9ca3af');
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerWrapRef = useRef<HTMLDivElement>(null);
    const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep local color in sync when parent fetches fresh data
    useEffect(() => { setLocalColor(node.color ?? '#9ca3af'); }, [node.color]);

    // Close picker when clicking outside of it
    const handleOutsideClick = useCallback((e: MouseEvent) => {
        if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target as HTMLElement)) {
            setPickerOpen(false);
        }
    }, []);

    useEffect(() => {
        if (pickerOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        } else {
            document.removeEventListener('mousedown', handleOutsideClick);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [pickerOpen, handleOutsideClick]);

    function handleColorChange(color: string) {
        setLocalColor(color);
        if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
        colorDebounceRef.current = setTimeout(() => {
            callbacks.onColorChange(node.id, color);
        }, 400);
    }

    function handleRename() {
        if (editName.trim()) {
            callbacks.onRename(node.id, editName.trim());
            setEditing(false);
        }
    }

    function handleAddChild() {
        if (newChildName.trim()) {
            callbacks.onAdd(node.id, newChildName.trim());
            setNewChildName('');
            setAddingChild(false);
        }
    }

    return (
        <div className="tree-node">
            <div
                className={`tree-node-row${isDragging ? ' tree-node-dragging' : ''}${isDragTarget ? ' tree-node-drag-target' : ''}`}
                draggable
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
            >
                {/* Drag handle */}
                <span className="drag-handle" title="Drag to reorder"><DragHandleIcon /></span>

                {/* Color swatch + popup picker */}
                <div ref={pickerWrapRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <span
                        className="category-color-swatch"
                        style={{ background: localColor }}
                        onClick={() => setPickerOpen(o => !o)}
                        title="Change color"
                    />
                    {pickerOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', borderRadius: 8, overflow: 'hidden' }}>
                            <HexColorPicker color={localColor} onChange={handleColorChange} />
                        </div>
                    )}
                </div>

                {editing ? (
                    <>
                        <input
                            className="inline-input"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') setEditing(false);
                            }}
                            autoFocus
                        />
                        <button className="btn btn-primary" onClick={handleRename}>Save</button>
                        <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                    </>
                ) : (
                    <>
                        <span className="tree-node-label">{node.name}</span>
                        <button
                            className="btn btn-icon"
                            onClick={() => { setEditing(true); setEditName(node.name); }}
                            title="Rename"
                        ><PencilIcon /></button>
                        <button
                            className="btn btn-icon"
                            style={{ color: '#16a34a' }}
                            onClick={() => setAddingChild(true)}
                            title="Add child category"
                        ><AddChildIcon /></button>
                        <button
                            className="btn btn-icon"
                            style={{ color: '#dc2626' }}
                            onClick={() => callbacks.onDelete(node.id)}
                            title="Delete"
                        ><TrashIcon /></button>
                    </>
                )}
            </div>

            {addingChild && (
                <div className="add-inline-row">
                    <input
                        className="inline-input"
                        value={newChildName}
                        onChange={e => setNewChildName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleAddChild();
                            if (e.key === 'Escape') setAddingChild(false);
                        }}
                        placeholder="New subcategory name"
                        autoFocus
                    />
                    <button className="btn btn-primary" onClick={handleAddChild}>Add</button>
                    <button className="btn btn-ghost" onClick={() => setAddingChild(false)}>Cancel</button>
                </div>
            )}

            {(node.children?.length ?? 0) > 0 && (
                <div className="tree-children">
                    <NodeList nodes={node.children!} callbacks={callbacks} />
                </div>
            )}
        </div>
    );
}

// ── NodeList — manages drag state among a set of siblings ─────────────────────

interface NodeListProps {
    nodes: Node[];
    callbacks: CategoryCallbacks;
}

function NodeList({ nodes, callbacks }: NodeListProps) {
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);

    const sorted = [...nodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    function handleDragStart(id: number, e: React.DragEvent) {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedId(id);
    }

    function handleDragOver(id: number, e: React.DragEvent) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (id !== draggedId) setDragOverId(id);
    }

    function handleDragLeave() {
        setDragOverId(null);
    }

    function handleDrop(targetId: number, e: React.DragEvent) {
        e.preventDefault();
        if (draggedId !== null && draggedId !== targetId) {
            callbacks.onSwap(draggedId, targetId);
        }
        setDraggedId(null);
        setDragOverId(null);
    }

    function handleDragEnd() {
        setDraggedId(null);
        setDragOverId(null);
    }

    return (
        <>
            {sorted.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    callbacks={callbacks}
                    isDragging={draggedId === node.id}
                    isDragTarget={dragOverId === node.id}
                    onDragStart={e => handleDragStart(node.id, e)}
                    onDragOver={e => handleDragOver(node.id, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(node.id, e)}
                    onDragEnd={handleDragEnd}
                />
            ))}
        </>
    );
}

// ── Categories root ───────────────────────────────────────────────────────────

interface CategoriesProps {
    nodes: Node[];
    callbacks: CategoryCallbacks;
}

function Categories({ nodes, callbacks }: CategoriesProps) {
    const [addingRoot, setAddingRoot] = useState(false);
    const [newRootName, setNewRootName] = useState('');

    function handleAddRoot() {
        if (newRootName.trim()) {
            callbacks.onAdd(null, newRootName.trim());
            setNewRootName('');
            setAddingRoot(false);
        }
    }

    return (
        <div className="categories-tree">
            {nodes.length === 0 && <p className="empty-msg">No categories yet.</p>}
            <NodeList nodes={nodes} callbacks={callbacks} />
            <div className="add-root-row">
                {addingRoot ? (
                    <>
                        <input
                            className="inline-input"
                            value={newRootName}
                            onChange={e => setNewRootName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleAddRoot();
                                if (e.key === 'Escape') setAddingRoot(false);
                            }}
                            placeholder="New root category name"
                            autoFocus
                        />
                        <button className="btn btn-primary" onClick={handleAddRoot}>Add</button>
                        <button className="btn btn-ghost" onClick={() => setAddingRoot(false)}>Cancel</button>
                    </>
                ) : (
                    <button className="btn btn-primary" onClick={() => setAddingRoot(true)}>+ Add Category</button>
                )}
            </div>
        </div>
    );
}

export default Categories;
