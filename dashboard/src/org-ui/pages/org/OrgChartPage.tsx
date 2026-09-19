import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { Network, Plus, Search } from "lucide-react";
import type {
  OrgChartClient,
  OrgDepartment,
  OrgEmployee,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { orgChartLabels } from "./labels";
import styles from "./OrgChartPage.module.css";

export interface OrgChartPageProps {
  client: OrgChartClient;
  session: OrgSession;
  locale: OrgLocale;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

type DeptForm = {
  name: string;
  description: string;
  parent_id: number | null;
};

type EmpForm = {
  name: string;
  role: string;
  description: string;
  employee_type: string;
  avatar_emoji: string;
  department_id: number;
};

function countEmployees(dept: OrgDepartment): number {
  const self = (dept.employees ?? []).length;
  return (
    self +
    (dept.children ?? []).reduce((sum, child) => sum + countEmployees(child), 0)
  );
}

function flattenDepartments(nodes: OrgDepartment[]): OrgDepartment[] {
  const out: OrgDepartment[] = [];
  const walk = (items: OrgDepartment[]) => {
    for (const item of items) {
      out.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return out;
}

function matchesQuery(dept: OrgDepartment, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (dept.name.toLowerCase().includes(q)) return true;
  if ((dept.description || "").toLowerCase().includes(q)) return true;
  if (
    (dept.employees ?? []).some(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        (emp.role || "").toLowerCase().includes(q),
    )
  ) {
    return true;
  }
  return (dept.children ?? []).some((child) => matchesQuery(child, query));
}

function employeeVisible(emp: OrgEmployee, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    emp.name.toLowerCase().includes(q) ||
    (emp.role || "").toLowerCase().includes(q)
  );
}

export function OrgChartPage({ client, session, locale }: OrgChartPageProps) {
  const labels = orgChartLabels(locale);
  const [tree, setTree] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptModal, setDeptModal] = useState<
    | { mode: "create"; parentId: number | null }
    | { mode: "edit"; dept: OrgDepartment }
    | null
  >(null);
  const [empModal, setEmpModal] = useState<
    | { mode: "create"; departmentId: number }
    | { mode: "edit"; emp: OrgEmployee }
    | null
  >(null);
  const [detail, setDetail] = useState<OrgEmployee | null>(null);
  const [deptForm, setDeptForm] = useState<DeptForm>({
    name: "",
    description: "",
    parent_id: null,
  });
  const [empForm, setEmpForm] = useState<EmpForm>({
    name: "",
    role: "",
    description: "",
    employee_type: "human",
    avatar_emoji: "👤",
    department_id: 0,
  });
  const [error, setError] = useState("");

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      setTree(await client.tree());
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  const totalEmployees = useMemo(
    () => tree.reduce((sum, node) => sum + countEmployees(node), 0),
    [tree],
  );
  const flatDepts = useMemo(() => flattenDepartments(tree), [tree]);
  const query = search.trim();
  const filtered = useMemo(
    () => tree.filter((node) => matchesQuery(node, query)),
    [tree, query],
  );

  const openCreateDept = (parentId: number | null) => {
    setError("");
    setDeptForm({ name: "", description: "", parent_id: parentId });
    setDeptModal({ mode: "create", parentId });
  };

  const openEditDept = (dept: OrgDepartment) => {
    setError("");
    setDeptForm({
      name: dept.name,
      description: dept.description || "",
      parent_id: dept.parent_id,
    });
    setDeptModal({ mode: "edit", dept });
  };

  const openCreateEmp = (departmentId: number) => {
    setError("");
    setEmpForm({
      name: "",
      role: "",
      description: "",
      employee_type: "human",
      avatar_emoji: "👤",
      department_id: departmentId,
    });
    setEmpModal({ mode: "create", departmentId });
  };

  const openEditEmp = (emp: OrgEmployee) => {
    setError("");
    setEmpForm({
      name: emp.name,
      role: emp.role || "",
      description: emp.description || "",
      employee_type: emp.employee_type || "human",
      avatar_emoji: emp.avatar_emoji || "👤",
      department_id: emp.department_id,
    });
    setEmpModal({ mode: "edit", emp });
    setDetail(null);
  };

  const submitDept = async () => {
    const name = deptForm.name.trim();
    if (!name) {
      setError(labels.required);
      return;
    }
    try {
      if (deptModal?.mode === "edit") {
        await client.updateDepartment(deptModal.dept.id, {
          name,
          description: deptForm.description,
          parent_id: deptForm.parent_id,
        });
      } else {
        await client.createDepartment({
          name,
          description: deptForm.description,
          parent_id: deptForm.parent_id,
        });
      }
      setDeptModal(null);
      await fetchTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const submitEmp = async () => {
    const name = empForm.name.trim();
    if (!name) {
      setError(labels.required);
      return;
    }
    try {
      if (empModal?.mode === "edit") {
        await client.updateEmployee(empModal.emp.id, {
          name,
          role: empForm.role,
          description: empForm.description,
          employee_type: empForm.employee_type,
          avatar_emoji: empForm.avatar_emoji,
          department_id: empForm.department_id,
        });
      } else {
        await client.createEmployee({
          name,
          role: empForm.role,
          description: empForm.description,
          employee_type: empForm.employee_type,
          avatar_emoji: empForm.avatar_emoji,
          department_id: empForm.department_id,
        });
      }
      setEmpModal(null);
      await fetchTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const deleteDept = async (dept: OrgDepartment) => {
    if (!window.confirm(labels.confirmDeleteDept)) return;
    try {
      await client.removeDepartment(dept.id);
      await fetchTree();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : labels.confirmDeleteDept,
      );
    }
  };

  const deleteEmp = async (emp: OrgEmployee) => {
    if (!window.confirm(labels.confirmDeleteEmp)) return;
    try {
      await client.removeEmployee(emp.id);
      setDetail(null);
      await fetchTree();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : labels.confirmDeleteEmp,
      );
    }
  };

  const renderNode = (dept: OrgDepartment) => {
    if (query && !matchesQuery(dept, query)) return null;
    const people = dept.employees ?? [];
    const visiblePeople = people.filter((emp) => employeeVisible(emp, query));
    return (
      <div
        key={dept.id}
        className={styles.node}
        data-testid={`org-chart-dept-${dept.id}`}
      >
        <div className={styles.nodeHead}>
          <Typography.Text className={styles.nodeTitle}>
            {dept.name}
          </Typography.Text>
          <Tag>{countEmployees(dept)}</Tag>
          {session.isAdmin ? (
            <Space size={4} className={styles.actions}>
              <Button
                type="link"
                size="small"
                onClick={() => openCreateEmp(dept.id)}
                data-testid={`org-chart-add-emp-${dept.id}`}
              >
                {labels.addEmployee}
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => openCreateDept(dept.id)}
              >
                {labels.addChild}
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => openEditDept(dept)}
              >
                {labels.editShort}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => void deleteDept(dept)}
              >
                {labels.deleteShort}
              </Button>
            </Space>
          ) : null}
        </div>
        {dept.description ? (
          <p className={styles.nodeMeta}>{dept.description}</p>
        ) : null}
        {visiblePeople.length ? (
          <div className={styles.people}>
            {visiblePeople.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className={styles.person}
                data-testid={`org-chart-emp-${emp.id}`}
                onClick={() => setDetail(emp)}
              >
                <span>{emp.avatar_emoji || "👤"}</span>
                <span>{emp.name}</span>
                {emp.role ? (
                  <span className={styles.nodeMeta}>{emp.role}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {(dept.children ?? []).length ? (
          <div className={styles.children}>
            {(dept.children ?? []).map((child) => renderNode(child))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.page} data-testid="org-ui-org-chart">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Network size={18} />
          <h1 className={styles.title}>{labels.title}</h1>
          <Tag>
            {totalEmployees} {labels.employees}
          </Tag>
        </div>
        {session.isAdmin ? (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => openCreateDept(null)}
            data-testid="org-chart-add-root"
          >
            {labels.addRoot}
          </Button>
        ) : null}
      </div>

      <div className={styles.filters}>
        <Input
          allowClear
          prefix={<Search size={14} />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.search}
          style={{ maxWidth: 260 }}
          data-testid="org-chart-search"
        />
      </div>

      {loading ? (
        <div className={styles.empty}>{labels.loading}</div>
      ) : tree.length === 0 ? (
        <div className={styles.empty} data-testid="org-chart-empty">
          {labels.empty}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>{labels.noMatch}</div>
      ) : (
        <div className={styles.tree}>
          {filtered.map((node) => renderNode(node))}
        </div>
      )}

      <Modal
        open={Boolean(detail)}
        title={detail?.name}
        footer={null}
        onCancel={() => setDetail(null)}
      >
        {detail ? (
          <Space direction="vertical" size={8}>
            <div>
              {detail.avatar_emoji || "👤"} {detail.role || "—"}
            </div>
            <Tag>
              {detail.employee_type === "ai" ? labels.typeAi : labels.typeHuman}
            </Tag>
            {detail.description ? (
              <p className={styles.nodeMeta}>{detail.description}</p>
            ) : null}
            {session.isAdmin ? (
              <Space>
                <Button onClick={() => openEditEmp(detail)}>
                  {labels.editShort}
                </Button>
                <Button danger onClick={() => void deleteEmp(detail)}>
                  {labels.deleteShort}
                </Button>
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deptModal)}
        title={
          deptModal?.mode === "edit" ? labels.editDepartment : labels.addRoot
        }
        onCancel={() => setDeptModal(null)}
        onOk={() => void submitDept()}
        okText={deptModal?.mode === "edit" ? labels.save : labels.create}
        okButtonProps={{ "data-testid": "org-chart-dept-submit" }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldName}
            </Typography.Text>
            <Input
              value={deptForm.name}
              onChange={(event) =>
                setDeptForm({ ...deptForm, name: event.target.value })
              }
              data-testid="org-chart-dept-name"
            />
          </div>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldDescription}
            </Typography.Text>
            <Input.TextArea
              rows={3}
              value={deptForm.description}
              onChange={(event) =>
                setDeptForm({ ...deptForm, description: event.target.value })
              }
            />
          </div>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldParent}
            </Typography.Text>
            <Select
              allowClear
              style={{ width: "100%" }}
              value={deptForm.parent_id ?? undefined}
              placeholder={labels.root}
              onChange={(value) =>
                setDeptForm({ ...deptForm, parent_id: value ?? null })
              }
              options={flatDepts
                .filter(
                  (dept) =>
                    dept.id !==
                    (deptModal?.mode === "edit" ? deptModal.dept.id : -1),
                )
                .map((dept) => ({ value: dept.id, label: dept.name }))}
            />
          </div>
          {error ? (
            <Typography.Text type="danger">{error}</Typography.Text>
          ) : null}
        </Space>
      </Modal>

      <Modal
        open={Boolean(empModal)}
        title={
          empModal?.mode === "edit" ? labels.editEmployee : labels.addEmployee
        }
        onCancel={() => setEmpModal(null)}
        onOk={() => void submitEmp()}
        okText={empModal?.mode === "edit" ? labels.save : labels.create}
        okButtonProps={{ "data-testid": "org-chart-emp-submit" }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldName}
            </Typography.Text>
            <Input
              value={empForm.name}
              onChange={(event) =>
                setEmpForm({ ...empForm, name: event.target.value })
              }
              data-testid="org-chart-emp-name"
            />
          </div>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldRole}
            </Typography.Text>
            <Input
              value={empForm.role}
              onChange={(event) =>
                setEmpForm({ ...empForm, role: event.target.value })
              }
            />
          </div>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldDescription}
            </Typography.Text>
            <Input.TextArea
              rows={3}
              value={empForm.description}
              onChange={(event) =>
                setEmpForm({ ...empForm, description: event.target.value })
              }
            />
          </div>
          <Space wrap>
            <Select
              value={empForm.employee_type}
              style={{ width: 160 }}
              onChange={(value) =>
                setEmpForm({ ...empForm, employee_type: value })
              }
              options={[
                { value: "human", label: labels.typeHuman },
                { value: "ai", label: labels.typeAi },
              ]}
            />
            <Input
              style={{ width: 80 }}
              value={empForm.avatar_emoji}
              onChange={(event) =>
                setEmpForm({ ...empForm, avatar_emoji: event.target.value })
              }
              aria-label={labels.fieldEmoji}
            />
          </Space>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldDepartment}
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={empForm.department_id || undefined}
              onChange={(value) =>
                setEmpForm({ ...empForm, department_id: value })
              }
              options={flatDepts.map((dept) => ({
                value: dept.id,
                label: dept.name,
              }))}
            />
          </div>
          {error ? (
            <Typography.Text type="danger">{error}</Typography.Text>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
}

export default OrgChartPage;
