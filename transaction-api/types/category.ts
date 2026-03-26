export interface CategoryDto {
    id: number;
    name: string | null;
    parent: number | null;
    index: number | null;
    color: string | null;
}

export interface CategoryNode extends CategoryDto {
    children: CategoryNode[];
}

export interface AddCategoryInput {
    name: string;
    parent?: number | null;
    index?: number;
}

export interface UpdateCategoryInput {
    name?: string;
    color?: string;
    index?: number;
}

export interface MoveCategoryInput {
    id: number;
    delta: number;
}
