import { RequestHandler } from 'express';
import { prisma } from '../db';
import type { categories } from '../generated/prisma/client';
import { CategoryDto, CategoryNode, AddCategoryInput, UpdateCategoryInput, MoveCategoryInput } from '../types/category';

// ── Color helpers ─────────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number): string => {
        const k = (n + h / 30) % 12;
        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function randomCategoryColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return hslToHex(hue, 62, 46);
}

// ── DTO builder ───────────────────────────────────────────────────────────────

function categoryToDto(c: categories): CategoryDto {
    return { id: c.id, name: c.name, parent: c.parent, index: c.index, color: c.color ?? null };
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(nodes: categories[]): CategoryNode[] {
    const nodeMap: Record<number, CategoryNode> = {};
    nodes.forEach(node => {
        nodeMap[node.id] = { ...categoryToDto(node), children: [] };
    });
    const tree: CategoryNode[] = [];
    nodes.forEach(node => {
        if (node.parent != null) {
            const parentNode = nodeMap[node.parent];
            if (parentNode) parentNode.children.push(nodeMap[node.id]);
        } else {
            tree.push(nodeMap[node.id]);
        }
    });
    return tree;
}

// ── GET /categories ───────────────────────────────────────────────────────────

export const fetchCategories: RequestHandler<{}, CategoryNode[]> = async (req, res) => {
    try {
        const rows = await prisma.categories.findMany();
        res.send(buildTree(rows));
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// ── POST /categories ──────────────────────────────────────────────────────────

export const addCategory: RequestHandler<{}, CategoryDto, AddCategoryInput> = async (req, res) => {
    try {
        const { name, parent, index } = req.body;

        let color: string;
        if (!parent || parent === 1) {
            // Root-level or direct child of "Others" → fresh random color
            color = randomCategoryColor();
        } else {
            // Inherit parent's color
            const parentNode = await prisma.categories.findUnique({ where: { id: parent } });
            color = parentNode?.color ?? randomCategoryColor();
        }

        const category = await prisma.categories.create({
            data: { name, parent: parent ?? null, index: index ?? 0, color }
        });
        res.status(201).send(categoryToDto(category));
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// ── PUT /categories/:id ───────────────────────────────────────────────────────

export const updateCategory: RequestHandler<{ id: string }, CategoryDto, UpdateCategoryInput> = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).send('invalid category id' as any); return; }
    const { name, color, index } = req.body;
    const data: Partial<{ name: string; color: string; index: number }> = {};
    if (name  !== undefined) data.name  = name;
    if (color !== undefined) data.color = color;
    if (index !== undefined) data.index = index;
    try {
        const updated = await prisma.categories.update({ where: { id }, data });
        res.send(categoryToDto(updated));
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// ── POST /categories/move ─────────────────────────────────────────────────────

export const moveCategory: RequestHandler<{}, string, MoveCategoryInput> = async (req, res) => {
    const { id, delta } = req.body;
    try {
        const node = await prisma.categories.findUnique({ where: { id } });
        if (!node) { res.status(404).send('invalid node id: ' + id); return; }

        const currentIndex = node.index!;
        const newIndex = currentIndex + delta;

        if (delta > 0) {
            await prisma.categories.updateMany({
                where: { index: { gte: currentIndex, lte: newIndex } },
                data: { index: { decrement: 1 } }
            });
        } else {
            await prisma.categories.updateMany({
                where: { index: { gte: newIndex, lte: currentIndex } },
                data: { index: { increment: 1 } }
            });
        }
        await prisma.categories.update({ where: { id }, data: { index: newIndex } });
        res.send('Ok');
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// ── DELETE /categories/:id ────────────────────────────────────────────────────

export const deleteCategory: RequestHandler<{ id: string }, string> = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).send('invalid category id'); return; }
    try {
        await prisma.categories.delete({ where: { id } });
        res.send('Ok');
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};


