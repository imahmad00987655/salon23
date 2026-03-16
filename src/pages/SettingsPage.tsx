import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Save, Eye, EyeOff, Shield, Key } from "lucide-react";

const UPDATE_PROFILE_API = "https://saddlebrown-antelope-612005.hostingersite.com/update_profile.php";
const USERS_API = "https://saddlebrown-antelope-612005.hostingersite.com/users.php";
const UPDATE_USER_PASSWORD_API = "https://saddlebrown-antelope-612005.hostingersite.com/update_user_password.php";

type ListUser = { id: number; name: string; email: string; role: string };

const SettingsPage = () => {
  const { user, setUserFromSettings } = useAuth();
  const { theme, toggle } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newName, setNewName] = useState(user?.name ?? "");
  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<ListUser[]>([]);
  const [passwordTargetId, setPasswordTargetId] = useState<string>("");
  const [manageCurrentPassword, setManageCurrentPassword] = useState("");
  const [manageNewPassword, setManageNewPassword] = useState("");
  const [showManageCurrent, setShowManageCurrent] = useState(false);
  const [showManageNew, setShowManageNew] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "manager" | "cashier">("cashier");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [createUserLoading, setCreateUserLoading] = useState(false);

  const canUpdateCredentials = user?.role === "super_admin" || user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin || !user) return;
    const load = async () => {
      try {
        const res = await fetch(USERS_API, {
          headers: { "X-User-Role": user.role },
        });
        if (res.ok) {
          const data = (await res.json()) as ListUser[];
          setUsers(data);
          if (data.length && !passwordTargetId) setPasswordTargetId(String(data[0].id));
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [isSuperAdmin, user?.role]);

  const selectedTargetUser = users.find((u) => String(u.id) === passwordTargetId);
  const isChangingOwnPassword = selectedTargetUser && String(user?.id) === String(selectedTargetUser.id);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canUpdateCredentials) return;
    if (!currentPassword.trim()) {
      setMessage({ type: "error", text: "Current password is required." });
      return;
    }
    if (!newName.trim()) {
      setMessage({ type: "error", text: "Name is required." });
      return;
    }
    if (!newEmail.trim()) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(UPDATE_PROFILE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user.id),
          "X-User-Role": user.role,
        },
        body: JSON.stringify({
          currentPassword,
          newName: newName.trim(),
          newEmail: newEmail.trim(),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: (data.error as string) || "Failed to update profile." });
        return;
      }
      setMessage({ type: "success", text: "Profile updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      if (data.user && setUserFromSettings) {
        setUserFromSettings(data.user);
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSuperAdmin || !passwordTargetId) return;
    const targetId = Number(passwordTargetId);
    if (isChangingOwnPassword && !manageCurrentPassword.trim()) {
      setPasswordMessage({ type: "error", text: "Current password is required to change your own password." });
      return;
    }
    if (manageNewPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const res = await fetch(UPDATE_USER_PASSWORD_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user.id),
          "X-User-Role": user.role,
        },
        body: JSON.stringify({
          targetUserId: targetId,
          ...(isChangingOwnPassword ? { currentPassword: manageCurrentPassword } : {}),
          newPassword: manageNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordMessage({ type: "error", text: (data.error as string) || "Failed to update password." });
        return;
      }
      setPasswordMessage({ type: "success", text: "Password updated successfully." });
      setManageCurrentPassword("");
      setManageNewPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSuperAdmin) return;
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setCreateUserMessage({ type: "error", text: "Name, email and password are required." });
      return;
    }
    if (newUserPassword.length < 6) {
      setCreateUserMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setCreateUserLoading(true);
    setCreateUserMessage(null);
    try {
      const res = await fetch(USERS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user.id),
          "X-User-Role": user.role,
        },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          password: newUserPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateUserMessage({ type: "error", text: (data.error as string) || "Failed to create user." });
        return;
      }
      setCreateUserMessage({ type: "success", text: "User created successfully." });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      // Refresh users list so new user appears in dropdown
      if (isSuperAdmin) {
        try {
          const reload = await fetch(USERS_API, { headers: { "X-User-Role": user.role } });
          if (reload.ok) {
            const fresh = (await reload.json()) as ListUser[];
            setUsers(fresh);
          }
        } catch {
          // ignore reload errors
        }
      }
    } catch {
      setCreateUserMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setCreateUserLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Application preferences</p>
      </div>

      {/* Profile */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-card-foreground">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <p className="text-sm text-foreground font-medium">{user?.name}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-sm text-foreground">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <p className="text-sm text-foreground capitalize">{user?.role.replace("_", " ")}</p>
          </div>
        </div>

        {canUpdateCredentials && (
          <form onSubmit={handleUpdateProfile} className="pt-4 border-t border-border space-y-4">
            <h3 className="text-sm font-medium text-card-foreground">Update login credentials</h3>
            {message && (
              <div
                className={`text-sm rounded-lg px-3 py-2 ${message.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
              >
                {message.text}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="settings-currentPassword" className="text-xs text-muted-foreground">
                Current password
              </label>
              <div className="relative">
                <input
                  id="settings-currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newName" className="text-xs text-muted-foreground">
                New name
              </label>
              <input
                id="settings-newName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newEmail" className="text-xs text-muted-foreground">
                New email
              </label>
              <input
                id="settings-newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newPassword" className="text-xs text-muted-foreground">
                New password (leave blank to keep current)
              </label>
              <div className="relative">
                <input
                  id="settings-newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {loading ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </section>

      {/* User management (Super Admin only) */}
      {isSuperAdmin && (
        <section className="bg-card border border-border rounded-lg p-5 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-heading font-semibold text-card-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              User management
            </h2>
            <p className="text-xs text-muted-foreground">
              Create new users and manage passwords for Admin, Manager and Cashier accounts.
            </p>
          </div>

          {/* Create user */}
          <form onSubmit={handleCreateUser} className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
            <h3 className="text-xs font-semibold text-card-foreground flex items-center gap-1">
              <Key className="h-3 w-3" />
              Create new user
            </h3>
            {createUserMessage && (
              <div
                className={`text-sm rounded-lg px-3 py-2 ${
                  createUserMessage.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {createUserMessage.text}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="settings-newUser-name" className="text-xs text-muted-foreground">
                Full name <span className="text-destructive">*</span>
              </label>
              <input
                id="settings-newUser-name"
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newUser-email" className="text-xs text-muted-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                id="settings-newUser-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newUser-role" className="text-xs text-muted-foreground">
                Role <span className="text-destructive">*</span>
              </label>
              <select
                id="settings-newUser-role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as "admin" | "manager" | "cashier")}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-newUser-password" className="text-xs text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="settings-newUser-password"
                  type={showNewUserPassword ? "text" : "password"}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={createUserLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {createUserLoading ? "Creating…" : "Create user"}
            </button>
          </form>

          {/* Manage user passwords */}
          {users.length > 0 && (
            <form onSubmit={handleUpdateUserPassword} className="space-y-4 border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold text-card-foreground flex items-center gap-1">
                <Key className="h-3 w-3" />
                Manage user passwords
              </h3>
              <p className="text-[11px] text-muted-foreground">
                When changing your own password, your current password is required.
              </p>
              {passwordMessage && (
                <div
                  className={`text-sm rounded-lg px-3 py-2 ${
                    passwordMessage.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="settings-password-user" className="text-xs text-muted-foreground">
                  Select user
                </label>
                <select
                  id="settings-password-user"
                  value={passwordTargetId}
                  onChange={(e) => setPasswordTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — {u.role.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              {isChangingOwnPassword && (
                <div className="space-y-1.5">
                  <label htmlFor="settings-manage-currentPassword" className="text-xs text-muted-foreground">
                    Current password (required for your account)
                  </label>
                  <div className="relative">
                    <input
                      id="settings-manage-currentPassword"
                      type={showManageCurrent ? "text" : "password"}
                      value={manageCurrentPassword}
                      onChange={(e) => setManageCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-10"
                      placeholder="Your current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowManageCurrent(!showManageCurrent)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showManageCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="settings-manage-newPassword" className="text-xs text-muted-foreground">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="settings-manage-newPassword"
                    type={showManageNew ? "text" : "password"}
                    value={manageNewPassword}
                    onChange={(e) => setManageNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowManageNew(!showManageNew)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showManageNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                <Key className="h-4 w-4" />
                {passwordLoading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
