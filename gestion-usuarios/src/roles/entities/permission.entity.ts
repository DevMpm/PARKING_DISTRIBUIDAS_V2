import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { RolePermission } from "./role-permission.entity";

@Entity('permission')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
 
  @Column({ unique: true })
  name!: string;

  // Microservicio dueño del permiso (ej: 'zonas-service', 'tickets-service').
  // Usado por la autorización pull para filtrar permisos por servicio consumidor.
  @Column({ type: 'varchar', nullable: true })
  service!: string | null;

  @Column({ default: true })
  active!: boolean;
 
  @CreateDateColumn()
  created_at!: Date;
 
  @Column({ type: 'text', nullable: true })
  description!: string;
 
  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions!: RolePermission[];
}
