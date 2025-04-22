\connect groceries;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS Users (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR NOT NULL UNIQUE,
    "password" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS FRIENDS(
    "user_id" UUID NOT NULL,
    "friend_id" UUID NOT NULL,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT not_self CHECK(user_id <> friend_id),
    CONSTRAINT ascending_friend_id CHECK(user_id > friend_id)
);

CREATE TABLE IF NOT EXISTS Task_relation(
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "created_at" TEXT NOT NULL,
    "relation_location" VARCHAR CHECK(relation_location IN ('Server')) DEFAULT 'Server'
);

CREATE TABLE IF NOT EXISTS TASK(
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "task" VARCHAR NOT NULL,
    "created_at" TEXT NOT NULL,
    "completed_at" TEXT,
    "completed_by" UUID,
    "task_relations_id" UUID,
    FOREIGN KEY (task_relations_id) REFERENCES Task_relation(id),
    FOREIGN KEY (completed_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS task_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_relation_id UUID NOT NULL REFERENCES task_relation(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(10) NOT NULL CHECK (permission IN ('owner', 'edit')),
    UNIQUE(task_relation_id, user_id)
);
