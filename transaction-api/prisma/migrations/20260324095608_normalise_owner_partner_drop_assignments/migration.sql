-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR,
    "parent" INTEGER,
    "index" INTEGER,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" SERIAL NOT NULL,
    "account_number" VARCHAR,
    "account_title" VARCHAR,
    "originator" VARCHAR,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR,
    "iban" VARCHAR,
    "bic" VARCHAR,
    "number" VARCHAR,
    "bank_code" VARCHAR,
    "country_code" VARCHAR,
    "prefix" VARCHAR,
    "secondary_id" VARCHAR,
    "address" VARCHAR,
    "originator" VARCHAR,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "partner_id" INTEGER,
    "reference_number" VARCHAR,
    "description" VARCHAR,
    "amount" DECIMAL,
    "currency" VARCHAR,
    "booking_date" TIMESTAMP(6),
    "validation_date" TIMESTAMP(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_fkey" FOREIGN KEY ("parent") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
