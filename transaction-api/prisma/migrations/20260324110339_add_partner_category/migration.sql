-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "category_id" INTEGER;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
