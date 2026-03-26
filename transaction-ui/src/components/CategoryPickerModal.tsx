import React from 'react';
import { Node } from './Categories';

interface CategoryPickerModalProps {
    categories: Node[];
    title: string;
    onSelect: (categoryId: number) => void;
    onClose: () => void;
}

function PickerNode({ node, onSelect }: { node: Node; onSelect: (id: number) => void }) {
    const sorted = [...(node.children ?? [])].sort((a, b) => a.index - b.index);
    return (
        <div className="picker-node">
            <div className="picker-node-label" onClick={() => onSelect(node.id)}>
                <span
                    className="picker-color-dot"
                    style={{ background: node.color ?? '#9ca3af' }}
                />
                {node.name}
            </div>
            {sorted.length > 0 && (
                <div className="picker-children">
                    {sorted.map(child => (
                        <PickerNode key={child.id} node={child} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryPickerModal({ categories, title, onSelect, onClose }: CategoryPickerModalProps) {
    const sorted = [...categories].sort((a, b) => a.index - b.index);
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">{title}</span>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {sorted.length === 0
                        ? <p className="empty-msg">No categories defined. Add some on the Categories page.</p>
                        : sorted.map(root => (
                            <PickerNode key={root.id} node={root} onSelect={onSelect} />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}

export default CategoryPickerModal;
