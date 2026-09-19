import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Space, Tag, Typography } from "antd";
import { ArrowLeft, User } from "lucide-react";
import type {
  OrgDepartment,
  OrgEmployee,
  OrgEmployeesClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { employeeLabels } from "./labels";
import styles from "./EmployeesPage.module.css";

export interface EmployeeDetailPageProps {
  client: OrgEmployeesClient;
  session: OrgSession;
  locale: OrgLocale;
  employeeId: number;
  onBack?: () => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

export function EmployeeDetailPage({
  client,
  session,
  locale,
  employeeId,
  onBack,
}: EmployeeDetailPageProps) {
  const labels = employeeLabels(locale);
  const [employee, setEmployee] = useState<OrgEmployee | null>(null);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [employeeType, setEmployeeType] = useState("human");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, depts] = await Promise.all([
        client.get(employeeId),
        client.listDepartments(),
      ]);
      setEmployee(row);
      setDepartments(depts);
      setName(row.name);
      setRole(row.role || "");
      setDescription(row.description || "");
      setSkills(row.skills || "");
      setEmployeeType(row.employee_type || "human");
      setDepartmentId(row.department_id);
    } catch {
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [client, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!name.trim() || departmentId == null) {
      setError(labels.required);
      return;
    }
    try {
      const row = await client.update(employeeId, {
        name: name.trim(),
        role,
        description,
        skills,
        employee_type: employeeType,
        department_id: departmentId,
      });
      setEmployee(row);
      setEditing(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const deactivate = async () => {
    if (!window.confirm(labels.confirmDeactivate)) return;
    try {
      await client.remove(employeeId);
      onBack?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.confirmDeactivate);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} data-testid="org-ui-employee-detail">
        <p className={styles.empty}>{labels.loading}</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className={styles.page} data-testid="org-ui-employee-detail">
        <p className={styles.empty} data-testid="org-employee-missing">
          {labels.notFound}
        </p>
        {onBack ? (
          <Button onClick={onBack} data-testid="org-employee-back">
            {labels.back}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="org-ui-employee-detail">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {onBack ? (
            <Button
              type="text"
              icon={<ArrowLeft size={16} />}
              onClick={onBack}
              data-testid="org-employee-back"
            />
          ) : null}
          <User size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {employee.name}
            </Typography.Title>
            <p className={styles.subtitle}>
              {employee.role || labels.noRole}
              {" · "}
              {employee.department_name || labels.noDepartment}
            </p>
          </div>
        </div>
        {session.isAdmin ? (
          <Space>
            {editing ? (
              <>
                <Button onClick={() => setEditing(false)}>
                  {labels.cancel}
                </Button>
                <Button
                  type="primary"
                  onClick={() => void save()}
                  data-testid="org-employee-save"
                >
                  {labels.save}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                data-testid="org-employee-edit"
              >
                {labels.edit}
              </Button>
            )}
            <Button
              danger
              onClick={() => void deactivate()}
              data-testid="org-employee-deactivate"
            >
              {labels.deactivate}
            </Button>
          </Space>
        ) : null}
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}

      <div className={styles.detailGrid}>
        <section className={styles.detailCard}>
          <Typography.Title level={5}>{labels.basic}</Typography.Title>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-testid="org-employee-name"
              />
              <Input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder={labels.fieldRole}
              />
              <Select
                value={employeeType}
                onChange={setEmployeeType}
                options={[
                  { value: "human", label: labels.typeHuman },
                  { value: "ai", label: labels.typeAi },
                ]}
              />
              <Select
                value={departmentId ?? undefined}
                onChange={setDepartmentId}
                options={departments.map((dept) => ({
                  value: dept.id,
                  label: dept.name,
                }))}
              />
              <Input
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                placeholder={labels.fieldSkillsHint}
              />
            </div>
          ) : (
            <>
              <div className={styles.row}>
                <span className={styles.muted}>{labels.fieldName}</span>
                <span>{employee.name}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.muted}>{labels.fieldRole}</span>
                <span>{employee.role || labels.noRole}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.muted}>{labels.fieldDepartment}</span>
                <span>{employee.department_name || labels.noDepartment}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.muted}>{labels.fieldType}</span>
                <Tag
                  color={employee.employee_type === "ai" ? "purple" : "blue"}
                >
                  {employee.employee_type === "ai"
                    ? labels.typeAi
                    : labels.typeHuman}
                </Tag>
              </div>
            </>
          )}
        </section>

        <section className={styles.detailCard}>
          <Typography.Title level={5}>
            {labels.fieldDescription}
          </Typography.Title>
          {editing ? (
            <Input.TextArea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          ) : (
            <p className={styles.body}>
              {employee.description || labels.noDescription}
            </p>
          )}
        </section>

        <section className={styles.detailCard}>
          <Typography.Title level={5}>{labels.fieldSkills}</Typography.Title>
          {employee.skills ? (
            <div className={styles.skills}>
              {employee.skills
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean)
                .map((skill) => (
                  <Tag key={skill}>{skill}</Tag>
                ))}
            </div>
          ) : (
            <p className={styles.muted}>{labels.noSkills}</p>
          )}
        </section>
      </div>
    </div>
  );
}
