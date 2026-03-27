import { useEffect, useState } from "react";
import { Service, ServiceCategory } from "@/types/pos";
import { Plus, Search, X, Clock, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const PROD_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com";
const SERVICES_API_BASE = import.meta.env.DEV ? "/api/services.php" : `${PROD_API_BASE}/services.php`;
const CATEGORIES_API_BASE = import.meta.env.DEV ? "/api/categories.php" : `${PROD_API_BASE}/categories.php`;
const UPLOADS_BASE = PROD_API_BASE;

const Services = () => {
  const NO_CATEGORY_ID = "none";
  const [serviceList, setServiceList] = useState<Service[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const loadCategories = async () => {
    try {
      const res = await fetch(CATEGORIES_API_BASE);
      if (!res.ok) return;
      const raw = (await res.json()) as { id: number; name: string; description: string }[];
      setServiceCategories(
        raw.map((c) => ({
          id: `cat-${c.id}`,
          name: c.name,
          description: c.description || "",
        }))
      );
    } catch {
      // keep existing categories from services if API fails
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const [svcRes, catRes] = await Promise.all([
        fetch(SERVICES_API_BASE),
        fetch(CATEGORIES_API_BASE),
      ]);
      if (catRes.ok) {
        const catRaw = (await catRes.json()) as { id: number; name: string; description: string }[];
        setServiceCategories(
          catRaw.map((c) => ({
            id: `cat-${c.id}`,
            name: c.name,
            description: c.description || "",
          }))
        );
      }
      if (!svcRes.ok) throw new Error("Failed to load services");
      const raw = (await svcRes.json()) as any[];
      const catMap = new Map<string, ServiceCategory>();
      const mapped: Service[] = raw.map((row) => {
        const hasCategory =
          row.category_id !== null && row.category_id !== undefined && Number(row.category_id) > 0;
        const catId = hasCategory ? `cat-${row.category_id}` : NO_CATEGORY_ID;
        if (hasCategory && !catMap.has(catId)) {
          catMap.set(catId, {
            id: catId,
            name: String(row.category_name || "Uncategorized"),
            description: String(row.category_description || ""),
          });
        }
        const imageUrl = row.image_url
          ? String(row.image_url).startsWith("http")
            ? String(row.image_url)
            : `${UPLOADS_BASE}/${String(row.image_url).replace(/^\/+/, "")}`
          : undefined;

        return {
          id: String(row.id),
          name: String(row.name),
          categoryId: catId,
          price: Number(row.price),
          duration: Number(row.duration),
          active: Boolean(row.active),
          image: imageUrl,
        };
      });
      setServiceList(mapped);
      if (!catRes.ok) {
        setServiceCategories(Array.from(catMap.values()));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleAddNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const duplicate = serviceCategories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      const msg = `Category "${name}" already exists. Please create a unique category name.`;
      setError(msg);
      window.alert(msg);
      return;
    }
    try {
      setError(null);
      const res = await fetch(CATEGORIES_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newCategoryDescription.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to create category");
      }
      const created = (await res.json()) as { id: number; name: string; description: string };
      setServiceCategories((prev) => [
        ...prev,
        { id: `cat-${created.id}`, name: created.name, description: created.description || "" },
      ]);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setShowNewCategory(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = serviceList.filter((s) => {
    const matchCat = filterCat === "all" || s.categoryId === filterCat;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const activeServices = filtered.filter((s) => s.active);
  const inactiveServices = filtered.filter((s) => !s.active);

  const totalPages = Math.max(1, Math.ceil(activeServices.length / pageSize));
  const paginated = activeServices.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filterCat, serviceList.length]);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim() ?? "";
    const categoryId = fd.get("categoryId") as string;
    const numericCategoryId = categoryId === NO_CATEGORY_ID ? 0 : Number(String(categoryId).replace("cat-", ""));
    const price = Number(fd.get("price"));
    const duration = Number(fd.get("duration"));
    const active = fd.get("active") === "on";
    const useFormData = serviceImageFile !== null;

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editing);
        const url = isEdit ? `${SERVICES_API_BASE}?id=${editing!.id}` : SERVICES_API_BASE;

        let res: Response;
        if (useFormData) {
          const formData = new FormData();
          formData.append("name", name);
          formData.append("categoryId", String(numericCategoryId));
          formData.append("price", String(price));
          formData.append("duration", String(duration));
          formData.append("active", active ? "1" : "0");
          if (serviceImageFile) formData.append("image", serviceImageFile);
          // PHP does not reliably parse multipart/form-data for real PUT requests.
          // For edit + image upload, send POST with method override.
          if (isEdit) {
            formData.append("_method", "PUT");
          }
          res = await fetch(url, {
            method: "POST",
            body: formData,
          });
        } else {
          res = await fetch(url, {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              categoryId: numericCategoryId,
              price,
              duration,
              active,
            }),
          });
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to save service");
        }
        await loadServices();
        setShowForm(false);
        setEditing(null);
        setServiceImageFile(null);
        setServiceImagePreview(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void submit();
  };

  const toggleActive = (id: string) => {
    const svc = serviceList.find((s) => s.id === id);
    if (!svc) return;

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const numericCategoryId = svc.categoryId === NO_CATEGORY_ID ? 0 : Number(String(svc.categoryId).replace("cat-", ""));
        const res = await fetch(`${SERVICES_API_BASE}?id=${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: svc.name,
            categoryId: numericCategoryId,
            price: svc.price,
            duration: svc.duration,
            active: !svc.active,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update service");
        }
        await loadServices();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void submit();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${serviceList.length} services`}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="service-search" className="sr-only">
            Search services
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input id="service-search" type="text" placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-card text-foreground text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilterCat("all")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5", filterCat === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>All</button>
          {serviceCategories.map((cat) => (
            <button key={cat.id} onClick={() => setFilterCat(cat.id)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5", filterCat === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Service</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Category</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Price</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Duration</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => {
              const cat = serviceCategories.find((c) => c.id === s.categoryId);
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer" onClick={() => { setEditing(s); setShowForm(true); }}>
                  <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="h-9 w-9 rounded-md object-cover border border-border" />
                      ) : (
                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                          <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {s.name}
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                    {cat?.name}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-foreground">Rs. {s.price}</td>
                  <td className="py-3 px-3 sm:px-4 text-muted-foreground"><Clock className="h-3 w-3 inline mr-1" />{s.duration} min</td>
                  <td className="py-3 px-3 sm:px-4">
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(s.id); }} className={cn("px-2 py-0.5 rounded text-xs font-medium", s.active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Inactive Services ({inactiveServices.length})</h3>
        </div>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Service</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Category</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Price</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Duration</th>
              <th className="text-left py-3 px-3 sm:px-4 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {inactiveServices.map((s) => {
              const cat = serviceCategories.find((c) => c.id === s.categoryId);
              return (
                <tr key={`inactive-${s.id}`} className="border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer" onClick={() => { setEditing(s); setShowForm(true); }}>
                  <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="h-9 w-9 rounded-md object-cover border border-border" />
                      ) : (
                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                          <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {s.name}
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-muted-foreground">{cat?.name}</td>
                  <td className="py-3 px-3 sm:px-4 text-foreground">Rs. {s.price}</td>
                  <td className="py-3 px-3 sm:px-4 text-muted-foreground"><Clock className="h-3 w-3 inline mr-1" />{s.duration} min</td>
                  <td className="py-3 px-3 sm:px-4">
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(s.id); }} className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                      Inactive
                    </button>
                  </td>
                </tr>
              );
            })}
            {inactiveServices.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">No inactive services</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeServices.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, activeServices.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{activeServices.length}</span> active services
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              Prev
            </button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setServiceImageFile(null); setServiceImagePreview(null); }}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">{editing ? "Edit" : "New"} Service</h2>
              <button type="button" onClick={() => { setShowForm(false); setServiceImageFile(null); setServiceImagePreview(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Service image</label>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {serviceImagePreview ? (
                      <img src={serviceImagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : editing?.image ? (
                      <img src={editing.image} alt={editing.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="service-image"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setServiceImageFile(file ?? null);
                        setServiceImagePreview(file ? URL.createObjectURL(file) : null);
                      }}
                      className="w-full text-sm text-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Images are stored on the server in their original format and size.                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="service-name" className="text-sm text-muted-foreground">
                  Service name <span className="text-destructive">*</span>
                </label>
                <input
                  id="service-name"
                  name="name"
                  defaultValue={editing?.name}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="service-categoryId" className="text-sm text-muted-foreground">
                  Category (optional)
                </label>
                <select
                  id="service-categoryId"
                  name="categoryId"
                  defaultValue={editing?.categoryId || serviceCategories[0]?.id || NO_CATEGORY_ID}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={NO_CATEGORY_ID}>No category (remove)</option>
                  {serviceCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!showNewCategory ? (
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add new category
                  </button>
                ) : (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-2 border border-border">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                    />
                    <input
                      type="text"
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                      >
                        Create category
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCategory(false); setNewCategoryName(""); setNewCategoryDescription(""); }}
                        className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="service-price" className="text-sm text-muted-foreground">
                    Price <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="service-price"
                    name="price"
                    type="number"
                    defaultValue={editing?.price}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="service-duration" className="text-sm text-muted-foreground">
                    Duration (min) <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="service-duration"
                    name="duration"
                    type="number"
                    defaultValue={editing?.duration}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <label htmlFor="service-active" className="flex items-center gap-2 text-sm text-foreground">
                <input id="service-active" name="active" type="checkbox" defaultChecked={editing?.active ?? true} className="rounded border-border" />
                Active
              </label>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">{editing ? "Update" : "Create"} Service</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
