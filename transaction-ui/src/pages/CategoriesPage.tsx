import React, { useEffect, useState } from 'react';
import Categories, { Node, CategoryCallbacks } from '../components/Categories';

const API_BASE = 'http://localhost:5000';

function CategoriesPage() {

    const [categories, setCategories] = useState<Node[]>([]);
    const [errorState, setErrorState] = useState<string>();

    useEffect(() => {
        fetchData();
    }, []);

    function fetchData(): void {
        fetch(`${API_BASE}/categories`)
            .then((response) => response.json())
            .then((data: Node[]) => {
                setCategories(data);
                setErrorState(undefined);
            })
            .catch((err) => {
                setErrorState(err.message);
            });
    }

    function findNode(nodes: Node[], id: number): Node | undefined {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return undefined;
    }

    function handleAdd(parentId: number | null, name: string): void {
        const siblings = parentId === null
            ? categories
            : findNode(categories, parentId)?.children ?? [];
        const maxIndex = siblings.reduce((max, n) => Math.max(max, n.index), -1);
        fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parent: parentId, index: maxIndex + 1 }),
        })
            .then(() => fetchData())
            .catch(err => setErrorState(err.message));
    }

    function handleRename(id: number, name: string): void {
        fetch(`${API_BASE}/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
            .then(() => fetchData())
            .catch(err => setErrorState(err.message));
    }

    function handleColorChange(id: number, color: string): void {
        fetch(`${API_BASE}/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color }),
        })
            .then(() => fetchData())
            .catch(err => setErrorState(err.message));
    }

    function handleDelete(id: number): void {
        if (!window.confirm('Delete this category and all its children?')) return;
        fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' })
            .then(() => fetchData())
            .catch(err => setErrorState(err.message));
    }

    function swapIndices(a: Node, b: Node): void {
        const aIndex = a.index;
        const bIndex = b.index;
        Promise.all([
            fetch(`${API_BASE}/categories/${a.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: bIndex }),
            }),
            fetch(`${API_BASE}/categories/${b.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: aIndex }),
            }),
        ])
            .then(() => fetchData())
            .catch(err => setErrorState(err.message));
    }

    function handleSwap(id1: number, id2: number): void {
        const n1 = findNode(categories, id1);
        const n2 = findNode(categories, id2);
        if (!n1 || !n2) return;
        swapIndices(n1, n2);
    }

    const callbacks: CategoryCallbacks = {
        onAdd: handleAdd,
        onRename: handleRename,
        onDelete: handleDelete,
        onSwap: handleSwap,
        onColorChange: handleColorChange,
    };

    return (
        <div className="page">
            <h2>Categories</h2>
            {errorState && <div className="error-msg">{errorState}</div>}
            <Categories nodes={categories} callbacks={callbacks} />
        </div>
    );
}

export default CategoriesPage;