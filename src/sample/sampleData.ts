export const SAMPLE_DBML = `Table users {
  id int [pk, increment]
  username varchar(50) [unique, not null]
  email varchar(100) [not null]
  created_at timestamp
}

Table posts {
  id int [pk, increment]
  user_id int [not null]
  title varchar(200) [not null]
  content text
  status varchar(20) [default: 'draft']
  published boolean [default: false]
  created_at timestamp
}

Table comments {
  id int [pk, increment]
  post_id int [not null]
  user_id int [not null]
  content text [not null]
  created_at timestamp
}

Table tags {
  id int [pk, increment]
  name varchar(50) [unique, not null]
}

Table post_tags {
  post_id int [not null]
  tag_id int [not null]
}

Table profiles {
  user_id int [pk]
  bio text
  avatar_url varchar(255)
  birthday date
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id
Ref: profiles.user_id > users.id
`

export const SAMPLE_DBML_COMPLEX = `// ─── 电商数据库 ───
Table categories {
  id int [pk, increment]
  parent_id int
  name varchar(100) [not null]
  slug varchar(100) [unique]
  sort_order int [default: 0]
  is_active boolean [default: true]
}

Table products {
  id int [pk, increment]
  category_id int
  name varchar(200) [not null]
  description text
  price decimal(10,2) [not null]
  stock int [default: 0]
  sku varchar(50) [unique]
  image_url varchar(500)
  is_active boolean [default: true]
  created_at timestamp
}

Table product_tags {
  product_id int
  tag_id int
}

Table tags {
  id int [pk, increment]
  name varchar(50) [unique, not null]
}

Table inventory {
  id int [pk, increment]
  product_id int [unique, not null]
  warehouse_id int
  quantity int [default: 0]
  updated_at timestamp
}

Table warehouses {
  id int [pk, increment]
  name varchar(100) [not null]
  location varchar(200)
  is_active boolean [default: true]
}

Ref: categories.parent_id > categories.id
Ref: products.category_id > categories.id
Ref: product_tags.product_id > products.id
Ref: product_tags.tag_id > tags.id
Ref: inventory.product_id > products.id
Ref: inventory.warehouse_id > warehouses.id
`

export const SAMPLE_PRISMA = `model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  email     String   @unique
  bio       String?
  createdAt DateTime @default(now())
  posts     Post[]
  comments  Comment[]
  profile   Profile?
}

model Profile {
  id        Int    @id @default(autoincrement())
  userId    Int    @unique
  bio       String?
  avatarUrl String?
  birthday  DateTime?
  user      User   @relation(fields: [userId], references: [id])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  userId    Int
  author    User     @relation(fields: [userId], references: [id])
  comments  Comment[]
  tags      Tag[]
}

model Comment {
  id        Int   @id @default(autoincrement())
  content   String
  postId    Int
  userId    Int
  post      Post  @relation(fields: [postId], references: [id])
  author    User  @relation(fields: [userId], references: [id])
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}

enum Role {
  ADMIN
  MODERATOR
  USER
}

model Staff {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  logs      StaffLog[]
}

model StaffLog {
  id        Int   @id @default(autoincrement())
  staffId   Int
  action    String
  targetId  Int?
  createdAt DateTime @default(now())
  staff     Staff @relation(fields: [staffId], references: [id])
}
`

export const SAMPLE_SQL_UNIVERSITY = `CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  founded_year INT
);

CREATE TABLE teachers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  department_id INT NOT NULL,
  title VARCHAR(50),
  hired_date DATE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  credits INT NOT NULL,
  teacher_id INT,
  department_id INT NOT NULL,
  max_students INT DEFAULT 50,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_no VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  department_id INT NOT NULL,
  enrolled_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE enrollments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  semester VARCHAR(20) NOT NULL,
  grade DECIMAL(3,1),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE KEY uk_enrollment (student_id, course_id, semester)
);

CREATE TABLE classrooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  building VARCHAR(50) NOT NULL,
  room_no VARCHAR(20) NOT NULL,
  capacity INT NOT NULL,
  has_projector BOOLEAN DEFAULT FALSE,
  UNIQUE KEY uk_room (building, room_no)
);

CREATE TABLE schedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  classroom_id INT NOT NULL,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  semester VARCHAR(20) NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);
`
