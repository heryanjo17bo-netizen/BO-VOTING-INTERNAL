import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { Outlet, OutletCode, Contestant, AuditLogEntry, StaffUser } from '../types/index.ts';
import {
  fetchOutlets,
  fetchAdminContestants,
  addAdminContestant,
  updateAdminContestant,
  toggleHideContestant,
  deleteAdminContestant,
  bulkDeleteContestants,
  resetSingleOutlet,
  toggleOutletVotingStatus,
  fetchAuditLogs,
  uploadContestantPhoto,
  fetchStaffConfig,
  addStaffMember,
  updateStaffPin,
  removeStaffMember,
} from '../utils/api.ts';
import { AdminLoginGate } from './AdminLoginGate.tsx';
import { appUrl, mediaUrl, withBase } from '../utils/basePath.ts';

interface AdminPortalProps {
  onNavigateHome: () => void;
}

function compressImageFile(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onNavigateHome }) => {
  // Staff Auth State - defaults to null so unauthorized visitors must authenticate
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    try {
      const saved = localStorage.getItem('bo_admin_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email && parsed?.role) {
          if (parsed.role === 'OUTLET_ADMIN' && parsed.assignedOutlet !== 'BOHO') {
            parsed.assignedOutlet = 'BOALL';
          }
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [allowedStaff, setAllowedStaff] = useState<StaffUser[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletCode>(() => {
    return currentUser?.role === 'OUTLET_ADMIN' && currentUser?.assignedOutlet === 'BOHO'
      ? 'BOHO'
      : 'BOALL';
  });

  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // EXACTLY THREE CORE SECTIONS
  const [activeSection, setActiveSection] = useState<'contestants' | 'voting_control' | 'leaderboard_qr'>('contestants');

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add / Edit Contestant Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [formName, setFormName] = useState('');
  const [formCostume, setFormCostume] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formConsent, setFormConsent] = useState(true);
  const [uploadRotation, setUploadRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Confirm Modals & Bulk Actions
  const [contestantToDelete, setContestantToDelete] = useState<Contestant | null>(null);
  const [confirmVotingToggle, setConfirmVotingToggle] = useState<boolean>(false);
  const [selectedContestantIds, setSelectedContestantIds] = useState<Set<string>>(new Set());
  const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isResetOutletModalOpen, setIsResetOutletModalOpen] = useState(false);
  const [isResettingOutlet, setIsResettingOutlet] = useState(false);

  // QR Modal
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrModalTitle, setQrModalTitle] = useState<string>('');
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');

  // Staff Management (Super Admin)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'SUPER_ADMIN' | 'OUTLET_ADMIN'>('OUTLET_ADMIN');
  const [newStaffOutlet, setNewStaffOutlet] = useState<OutletCode>('BOALL');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingPinEmail, setEditingPinEmail] = useState<string | null>(null);
  const [editingPinValue, setEditingPinValue] = useState<string>('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [customLoginEmail, setCustomLoginEmail] = useState('');
  const [isCustomLoginOpen, setIsCustomLoginOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStaffConfig()
      .then((res) => {
        setAllowedStaff(res.allowedStaff);
      })
      .catch(console.error);

    fetchOutlets()
      .then((res) => {
        setOutlets(res);
      })
      .catch(console.error);
  }, []);

  const [localBackupForOutlet, setLocalBackupForOutlet] = useState<Contestant[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');

  const checkLocalBackup = (code: OutletCode, currentCount: number) => {
    try {
      const raw = localStorage.getItem('bo_contestants_backup');
      if (raw) {
        const all: Contestant[] = JSON.parse(raw);
        // Automatically migrate any contestants from legacy branches to BOALL
        const normalizedList: Contestant[] = all.map((c) => ({
          ...c,
          outletCode: c.outletCode === 'BOHO' ? 'BOHO' : 'BOALL',
        }));
        try {
          localStorage.setItem('bo_contestants_backup', JSON.stringify(normalizedList));
        } catch {}

        const forOutlet = normalizedList.filter((c) => c.outletCode === code);
        if (currentCount === 0 && forOutlet.length > 0) {
          setLocalBackupForOutlet(forOutlet);
        } else {
          setLocalBackupForOutlet([]);
        }
      } else {
        setLocalBackupForOutlet([]);
      }
    } catch {
      setLocalBackupForOutlet([]);
    }
  };

  const saveToLocalBackup = (c: Contestant) => {
    try {
      const raw = localStorage.getItem('bo_contestants_backup');
      const list: Contestant[] = raw ? JSON.parse(raw) : [];
      const index = list.findIndex((item) => item.id === c.id);
      if (index >= 0) {
        list[index] = c;
      } else {
        list.push(c);
      }
      localStorage.setItem('bo_contestants_backup', JSON.stringify(list));
    } catch (err) {
      console.error('Failed to save to local backup:', err);
    }
  };

  const removeFromLocalBackup = (ids: string[]) => {
    try {
      const raw = localStorage.getItem('bo_contestants_backup');
      if (!raw) return;
      const list: Contestant[] = JSON.parse(raw);
      const set = new Set(ids);
      const filtered = list.filter((item) => !set.has(item.id));
      localStorage.setItem('bo_contestants_backup', JSON.stringify(filtered));
    } catch (err) {
      console.error('Failed to remove from local backup:', err);
    }
  };

  const handleRestoreFromLocalBackup = async () => {
    if (!currentUser || localBackupForOutlet.length === 0) return;
    setIsRestoring(true);
    try {
      let restored = 0;
      for (const c of localBackupForOutlet) {
        await addAdminContestant({
          outletCode: c.outletCode,
          name: c.name,
          costume: c.costume || c.instagram || '',
          instagram: c.instagram || c.costume,
          phoneNumber: c.phoneNumber,
          description: c.description,
          imageUrl: c.imageUrl,
          hasConsented: c.hasConsented !== false,
          actor: currentUser.name,
        });
        restored++;
      }
      showToast(`Berhasil memulihkan ${restored} kontestan ke database server!`, 'success');
      setLocalBackupForOutlet([]);
      loadContestants(selectedOutlet);
      fetchOutlets().then(setOutlets);
    } catch (err: any) {
      showToast(err.message || 'Gagal memulihkan kontestan', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const loadContestants = async (code: OutletCode) => {
    setIsLoading(true);
    try {
      const data = await fetchAdminContestants(code);
      setContestants(data.contestants);
      setNextNumber(data.nextNumber);
      checkLocalBackup(code, data.contestants.length);
    } catch (err: any) {
      showToast(err.message || 'Error loading contestants', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudit = async (code?: OutletCode) => {
    try {
      const logs = await fetchAuditLogs(code);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadContestants(selectedOutlet);
    if (activeSection === 'voting_control') {
      loadAudit(selectedOutlet);
    }
  }, [selectedOutlet, activeSection]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Staff switch (simulates authentication with allowlist check)
  const handleSwitchStaff = (user: StaffUser) => {
    setCurrentUser(user);
    localStorage.setItem('bo_admin_user', JSON.stringify(user));
    if (user.role === 'OUTLET_ADMIN' && user.assignedOutlet) {
      setSelectedOutlet(user.assignedOutlet === 'BOHO' ? 'BOHO' : 'BOALL');
    }
    showToast(`Signed in as ${user.name} (${user.role})`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('bo_admin_user');
    setCurrentUser(null);
    showToast('Signed out of Admin Portal', 'success');
  };

  // Handle Photo File Select & Upload with compression fallback
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Generate local compressed data URL immediately for offline durability
      const localDataUrl = await compressImageFile(file);
      let serverUrl = '';
      try {
        serverUrl = await uploadContestantPhoto(file);
      } catch (uploadErr) {
        console.warn('Server photo upload fallback to compressed data URL:', uploadErr);
      }
      // Use server URL if successful, otherwise robust compressed data URL
      const chosenUrl = serverUrl || localDataUrl;
      setFormImageUrl(chosenUrl);
      setUploadRotation(0);
      showToast('Foto kontestan berhasil diproses', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRotatePhoto = () => {
    setUploadRotation((prev) => (prev + 90) % 360);
  };

  const openAddModal = () => {
    setEditingContestant(null);
    setFormName('');
    setFormCostume('');
    setFormPhone('');
    setFormDesc('');
    setFormImageUrl('');
    setFormConsent(true);
    setUploadRotation(0);
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Contestant) => {
    setEditingContestant(c);
    setFormName(c.name);
    setFormCostume(c.instagram || c.costume);
    setFormPhone(c.phoneNumber || '');
    setFormDesc(c.description || '');
    setFormImageUrl(c.imageUrl);
    setFormConsent(c.hasConsented);
    setUploadRotation(0);
    setIsAddModalOpen(true);
  };

  const handleSaveContestant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!formName.trim() || !formCostume.trim() || !formImageUrl.trim()) {
      showToast('Harap isi Nama, Akun Instagram (@...), dan upload Foto Kontestan.', 'error');
      return;
    }

    if (!formConsent) {
      showToast('Consent checkbox is required before publishing.', 'error');
      return;
    }

    // Ensure Instagram username begins with @
    const rawIg = formCostume.trim();
    const normalizedIg = rawIg.startsWith('@') ? rawIg : `@${rawIg}`;
    const cleanPhone = formPhone.trim() || undefined;

    setIsLoading(true);
    try {
      if (editingContestant) {
        const updated = await updateAdminContestant(
          editingContestant.id,
          {
            name: formName.trim(),
            costume: normalizedIg,
            instagram: normalizedIg,
            phoneNumber: cleanPhone,
            description: formDesc.trim(),
            imageUrl: formImageUrl,
          },
          currentUser.name
        );
        saveToLocalBackup(updated);
        showToast(`Contestant ${editingContestant.numberDisplay} updated`, 'success');
      } else {
        const added = await addAdminContestant({
          outletCode: selectedOutlet,
          name: formName.trim(),
          costume: normalizedIg,
          instagram: normalizedIg,
          phoneNumber: cleanPhone,
          description: formDesc.trim(),
          imageUrl: formImageUrl,
          hasConsented: formConsent,
          actor: currentUser.name,
        });
        saveToLocalBackup(added);
        showToast('Kontestan baru berhasil diterbitkan & tersimpan aman di server', 'success');
      }
      setIsAddModalOpen(false);
      loadContestants(selectedOutlet);
      fetchOutlets().then(setOutlets);
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHide = async (c: Contestant) => {
    if (!currentUser) return;
    try {
      await toggleHideContestant(c.id, currentUser.name);
      showToast(`Contestant ${c.numberDisplay} is now ${c.isActive ? 'hidden' : 'active'}`, 'success');
      loadContestants(selectedOutlet);
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle visibility', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!contestantToDelete || !currentUser) return;
    try {
      await deleteAdminContestant(contestantToDelete.id, currentUser.name);
      removeFromLocalBackup([contestantToDelete.id]);
      showToast(`Deleted contestant ${contestantToDelete.numberDisplay}`, 'success');
      setContestantToDelete(null);
      loadContestants(selectedOutlet);
      fetchOutlets().then(setOutlets);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete contestant', 'error');
    }
  };

  const executeToggleVoting = async () => {
    if (!currentUser) return;
    const current = outlets.find((o) => o.code === selectedOutlet);
    if (!current) return;
    const newStatus = !current.votingActive;

    try {
      const updated = await toggleOutletVotingStatus(selectedOutlet, newStatus, currentUser.name);
      setOutlets((prev) => prev.map((o) => (o.code === selectedOutlet ? updated : o)));
      setConfirmVotingToggle(false);
      showToast(`Voting is now ${newStatus ? 'OPEN' : 'CLOSED'} for ${updated.name}`, 'success');
      if (activeSection === 'voting_control') {
        loadAudit(selectedOutlet);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to change voting status', 'error');
    }
  };

  const openQrModal = (url: string, title: string) => {
    setQrModalUrl(url);
    setQrModalTitle(title);
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: {
        dark: '#211D1C',
        light: '#F6AC67',
      },
    })
      .then(setGeneratedQrDataUrl)
      .catch((err) => console.error(err));
  };

  const handleResetCurrentOutlet = async () => {
    if (!currentUser) return;
    setIsResettingOutlet(true);
    try {
      const res = await resetSingleOutlet(selectedOutlet, currentUser.name);
      try {
        const raw = localStorage.getItem('bo_contestants_backup');
        if (raw) {
          const list: Contestant[] = JSON.parse(raw);
          const filtered = list.filter((item) => item.outletCode !== selectedOutlet);
          localStorage.setItem('bo_contestants_backup', JSON.stringify(filtered));
        }
      } catch {}
      showToast(res.message || `Reset ${selectedOutlet} to 0 contestants and 0 votes`, 'success');
      setIsResetOutletModalOpen(false);
      setResetConfirmationInput('');
      setSelectedContestantIds(new Set());
      loadContestants(selectedOutlet);
      fetchOutlets().then(setOutlets);
      if (activeSection === 'voting_control') {
        loadAudit(selectedOutlet);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset venue outlet', 'error');
    } finally {
      setIsResettingOutlet(false);
    }
  };

  const handleToggleSelectContestant = (id: string) => {
    setSelectedContestantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllContestants = () => {
    if (selectedContestantIds.size === filteredContestants.length) {
      setSelectedContestantIds(new Set());
    } else {
      setSelectedContestantIds(new Set(filteredContestants.map((c) => c.id)));
    }
  };

  const handleBulkDeleteContestants = async () => {
    if (!currentUser || selectedContestantIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedContestantIds);
      const res = await bulkDeleteContestants(ids, selectedOutlet, currentUser.name);
      removeFromLocalBackup(ids);
      showToast(res.message || `Deleted ${ids.length} contestants`, 'success');
      setIsConfirmBulkDeleteOpen(false);
      setSelectedContestantIds(new Set());
      loadContestants(selectedOutlet);
      fetchOutlets().then(setOutlets);
    } catch (err: any) {
      showToast(err.message || 'Failed to bulk delete contestants', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim() || !newStaffName.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    setIsAddingStaff(true);
    try {
      const res = await addStaffMember({
        email: newStaffEmail.trim(),
        name: newStaffName.trim(),
        role: newStaffRole,
        assignedOutlet: newStaffRole === 'OUTLET_ADMIN' ? newStaffOutlet : undefined,
        pin: newStaffPin.trim() || undefined,
      });
      setAllowedStaff(res.allowedStaff);
      showToast(`Added ${newStaffName} as ${newStaffRole}`, 'success');
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPin('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add staff', 'error');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleSavePin = async (email: string) => {
    setIsSavingPin(true);
    try {
      const res = await updateStaffPin(email, editingPinValue.trim() || undefined);
      setAllowedStaff(res.allowedStaff);
      showToast(`Updated PIN for ${email}`, 'success');
      setEditingPinEmail(null);
      setEditingPinValue('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update PIN', 'error');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemoveStaff = async (email: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Revoke admin access for ${email}?`)) return;
    try {
      const res = await removeStaffMember(email);
      setAllowedStaff(res.allowedStaff);
      showToast(`Revoked access for ${email}`, 'success');
      if (currentUser.email.toLowerCase() === email.toLowerCase()) {
        const fallback = res.allowedStaff.find((s) => s.role === 'SUPER_ADMIN') || res.allowedStaff[0];
        if (fallback) handleSwitchStaff(fallback);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove staff', 'error');
    }
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emailToFind = customLoginEmail.trim().toLowerCase();
    const found = allowedStaff.find((s) => s.email.toLowerCase() === emailToFind);
    if (found) {
      handleSwitchStaff(found);
      setIsCustomLoginOpen(false);
      setCustomLoginEmail('');
      showToast(`Signed in as ${found.name}`, 'success');
    } else {
      showToast(`${customLoginEmail} is not on the authorized staff allowlist.`, 'error');
    }
  };

  if (!currentUser) {
    return (
      <AdminLoginGate
        allowedStaff={allowedStaff}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('bo_admin_user', JSON.stringify(user));
          if (user.role === 'OUTLET_ADMIN' && user.assignedOutlet) {
            setSelectedOutlet(user.assignedOutlet);
          }
          showToast(`Welcome back, ${user.name}!`, 'success');
        }}
        onBackToHome={onNavigateHome}
      />
    );
  }

  const currentOutletObj = outlets.find((o) => o.code === selectedOutlet);
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const filteredContestants = contestants.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.costume.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.instagram && c.instagram.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phoneNumber && c.phoneNumber.includes(searchQuery)) ||
      c.numberDisplay.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#1F1A19] text-[#F7F0EA] flex flex-col md:flex-row">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            notification.type === 'success'
              ? 'bg-[#342D2A] border-[#D8B37A] text-[#F6AC67]'
              : 'bg-rose-950/90 border-rose-500 text-rose-200'
          }`}
        >
          <span className="text-xs sm:text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-[#26201E] border-r border-[#342D2A] flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 pb-5 border-b border-[#342D2A]">
            <img
              src={mediaUrl("/assets/aistudio/BO_LOGO_cc0ca4aa.png")}
              alt="Black Owl"
              className="w-11 h-11 object-contain drop-shadow"
            />
            <div>
              <h2 className="font-['Cinzel'] font-bold text-sm tracking-wider text-[#F7F0EA]">
                BLACK OWL
              </h2>
              <span className="text-[10px] text-[#D8B37A] font-semibold uppercase tracking-widest block">
                ADMIN PORTAL
              </span>
            </div>
          </div>

          {/* Current Staff Profile */}
          <div className="mt-4 p-3 rounded-2xl bg-[#342D2A] border border-[#4A3F39] text-xs">
            <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider block">
              Authorized Staff
            </span>
            <div className="font-bold text-[#F7F0EA] truncate mt-0.5">{currentUser.name}</div>
            <div className="mt-2 flex items-center justify-between gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#211D1C] text-[#F6AC67] border border-[#F6AC67]/30">
                {currentUser.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : `OUTLET ADMIN (${currentUser.assignedOutlet})`}
              </span>
              <button
                onClick={handleLogout}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-0.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors cursor-pointer"
                title="Sign out of Admin Portal"
              >
                Sign Out
              </button>
            </div>

            {/* Staff Role Switcher for Testing / Permissions Checking */}
            <div className="mt-3 pt-2 border-t border-[#4A3F39]/60">
              <label htmlFor="staff-role-switcher" className="text-[9px] text-[#AFA39B] uppercase block mb-1">
                Simulate Authorized Staff:
              </label>
              <select
                id="staff-role-switcher"
                aria-label="Simulate Authorized Staff"
                className="w-full bg-[#211D1C] text-[11px] text-[#F7F0EA] rounded-lg p-1.5 border border-[#4A3F39] focus:outline-none"
                value={currentUser.email}
                onChange={(e) => {
                  const target = allowedStaff.find((s) => s.email === e.target.value);
                  if (target) handleSwitchStaff(target);
                }}
              >
                {allowedStaff.map((staff) => (
                  <option key={staff.email} value={staff.email}>
                    {staff.name} ({staff.role === 'SUPER_ADMIN' ? 'Super Admin' : staff.assignedOutlet})
                  </option>
                ))}
              </select>

              {/* Super Admin: Manage Staff Allowlist Button */}
              {isSuperAdmin && (
                <button
                  onClick={() => setIsStaffModalOpen(true)}
                  className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-[#F6AC67]/15 hover:bg-[#F6AC67]/25 text-[#F6AC67] border border-[#F6AC67]/30 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Manage Staff & Admins
                </button>
              )}

              {/* Login with specific email toggle */}
              <button
                type="button"
                onClick={() => setIsCustomLoginOpen(!isCustomLoginOpen)}
                className="mt-2 w-full text-center text-[10px] text-[#AFA39B] hover:text-[#D8B37A] transition-colors cursor-pointer block"
              >
                {isCustomLoginOpen ? '▲ Close Email Login' : '▼ Sign In with another email'}
              </button>

              {isCustomLoginOpen && (
                <form onSubmit={handleCustomLogin} className="mt-2 pt-2 border-t border-[#4A3F39]/60">
                  <input
                    type="email"
                    placeholder="staff@blackowl.id"
                    value={customLoginEmail}
                    onChange={(e) => setCustomLoginEmail(e.target.value)}
                    className="w-full bg-[#211D1C] text-[11px] text-[#F7F0EA] rounded-lg p-1.5 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67] mb-1.5"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-1 rounded-lg bg-[#D8B37A] text-[#211D1C] font-bold text-[10px] uppercase tracking-wider hover:bg-[#F6AC67] transition-colors cursor-pointer"
                  >
                    Authenticate Email
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* THREE CORE ADMIN SECTIONS */}
          <nav className="mt-6 space-y-1.5">
            {/* Section 1: Contestants */}
            <button
              onClick={() => setActiveSection('contestants')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wider cursor-pointer transition-colors ${
                activeSection === 'contestants'
                  ? 'bg-[#F6AC67] text-[#211D1C] shadow-md'
                  : 'text-[#AFA39B] hover:text-[#F7F0EA] hover:bg-[#342D2A]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>1. CONTESTANTS</span>
            </button>

            {/* Section 2: Voting Control */}
            <button
              onClick={() => setActiveSection('voting_control')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wider cursor-pointer transition-colors ${
                activeSection === 'voting_control'
                  ? 'bg-[#F6AC67] text-[#211D1C] shadow-md'
                  : 'text-[#AFA39B] hover:text-[#F7F0EA] hover:bg-[#342D2A]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>2. VOTING CONTROL</span>
            </button>

            {/* Section 3: Leaderboard & QR */}
            <button
              onClick={() => setActiveSection('leaderboard_qr')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wider cursor-pointer transition-colors ${
                activeSection === 'leaderboard_qr'
                  ? 'bg-[#F6AC67] text-[#211D1C] shadow-md'
                  : 'text-[#AFA39B] hover:text-[#F7F0EA] hover:bg-[#342D2A]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>3. LEADERBOARD & QR</span>
            </button>
          </nav>
        </div>

        {/* Back to Public Portal Button */}
        <div className="pt-4 border-t border-[#342D2A]">
          <button
            onClick={onNavigateHome}
            className="w-full py-2.5 px-3 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] text-xs font-semibold text-[#D8B37A] hover:text-[#F6AC67] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            OUTLET DIRECTORY
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        {/* Top Header with Outlet Scope */}
        <header className="p-4 sm:p-6 bg-[#211D1C] border-b border-[#342D2A] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] text-[#AFA39B] font-bold uppercase tracking-wider block">
                Active Venue Scope
              </span>
              <div className="flex items-center gap-3 mt-0.5">
                {isSuperAdmin ? (
                  <select
                    aria-label="Select Venue Outlet"
                    className="bg-[#342D2A] text-sm font-bold text-[#F7F0EA] rounded-xl px-3 py-1.5 border border-[#4A3F39] focus:outline-none focus:border-[#D8B37A] cursor-pointer"
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value as OutletCode)}
                  >
                    {outlets.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} — {o.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#342D2A] border border-[#4A3F39]">
                    <span className="font-['Cinzel'] font-bold text-sm text-[#F7F0EA]">
                      {currentOutletObj?.name} ({selectedOutlet})
                    </span>
                    <span className="text-[10px] text-[#D8B37A] uppercase font-bold px-1.5 py-0.5 bg-[#211D1C] rounded">
                      Locked to your Outlet
                    </span>
                  </div>
                )}

                {/* Voting Status Pill */}
                <div
                  className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    currentOutletObj?.votingActive
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                      : 'bg-rose-950 text-rose-400 border border-rose-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentOutletObj?.votingActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <span>{currentOutletObj?.votingActive ? 'Voting Open' : 'Voting Closed'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Quick Launch Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href={withBase(`/vote/${selectedOutlet}`)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] border border-[#4A3F39] text-[#F7F0EA] hover:text-[#F6AC67] font-semibold flex items-center gap-1.5"
            >
              <span>Guest Vote</span>
              <svg className="w-3 h-3 text-[#AFA39B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <a
              href={withBase(`/leaderboard/${selectedOutlet}`)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] border border-[#4A3F39] text-[#F7F0EA] hover:text-[#F6AC67] font-semibold flex items-center gap-1.5"
            >
              <span>Leaderboard</span>
              <svg className="w-3 h-3 text-[#AFA39B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <a
              href={withBase(`/display/${selectedOutlet}`)}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] font-extrabold flex items-center gap-1.5 shadow"
            >
              <span>16:9 LED Screen</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign out of Admin Portal"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* SECTION 1: CONTESTANTS */}
        {activeSection === 'contestants' && (
          <main className="p-4 sm:p-6 flex-1 space-y-6">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Total Contestants
                </span>
                <div className="text-2xl font-['Cinzel'] font-black text-[#F7F0EA] mt-1">
                  {contestants.length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Total Recorded Votes
                </span>
                <div className="text-2xl font-['Cinzel'] font-black text-[#F6AC67] mt-1">
                  {currentOutletObj?.totalVotes || 0}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Auto-Generated Next #
                </span>
                <div className="text-2xl font-['Cinzel'] font-black text-[#D8B37A] mt-1">
                  #{nextNumber.toString().padStart(2, '0')}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Ballot Status
                </span>
                <div className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {currentOutletObj?.votingActive ? 'Open to Guests' : 'Paused by Admin'}
                </div>
              </div>
            </div>

            {/* Controls Bar: Search & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, akun IG (@...), no. telepon, atau #nomor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#2A2422] border border-[#4A3F39] rounded-2xl py-2.5 pl-10 pr-4 text-xs text-[#F7F0EA] placeholder-[#AFA39B] focus:outline-none focus:border-[#D8B37A]"
                />
                <svg
                  className="w-4 h-4 text-[#AFA39B] absolute left-3.5 top-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loadContestants(selectedOutlet);
                    fetchOutlets().then(setOutlets);
                    showToast('Data kontestan dimuat ulang', 'success');
                  }}
                  className="py-2.5 px-3.5 rounded-2xl bg-[#342D2A] hover:bg-[#3E3531] border border-[#4A3F39] text-[#D8B37A] hover:text-[#F6AC67] text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Muat ulang data kontestan dari server"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>REFRESH</span>
                </button>

                <button
                  onClick={openAddModal}
                  className="py-2.5 px-4 rounded-2xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>ADD CONTESTANT</span>
                </button>
              </div>
            </div>

            {/* Local Device Backup Restoration Banner */}
            {localBackupForOutlet.length > 0 && contestants.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border border-[#F6AC67]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F6AC67]/20 border border-[#F6AC67]/40 flex items-center justify-center text-[#F6AC67] flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#F7F0EA]">Cadangan Kontestan Ditemukan di Perangkat Ini</h4>
                    <p className="text-[11px] text-[#AFA39B] mt-0.5">
                      Ditemukan <strong className="text-[#F6AC67]">{localBackupForOutlet.length} kontestan</strong> yang pernah Anda daftarkan untuk {selectedOutlet}. Klik tombol di samping untuk langsung memulihkan ke database server.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreFromLocalBackup}
                  disabled={isRestoring}
                  className="py-2.5 px-4 rounded-xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] font-black text-xs uppercase tracking-wider transition-colors shadow cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isRestoring ? 'Memulihkan...' : `Pulihkan ${localBackupForOutlet.length} Kontestan ke Server`}
                </button>
              </div>
            )}
            {selectedContestantIds.size > 0 && (
              <div className="p-3 bg-[#342D2A] border border-[#F6AC67] rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F6AC67] animate-ping" />
                  <span className="text-xs font-black text-[#F7F0EA]">
                    {selectedContestantIds.size} Contestant{selectedContestantIds.size > 1 ? 's' : ''} Selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmBulkDeleteOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-colors shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete Selected ({selectedContestantIds.size})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedContestantIds(new Set())}
                    className="px-3 py-1.5 rounded-xl bg-[#211D1C] border border-[#4A3F39] text-[#AFA39B] hover:text-[#F7F0EA] text-xs font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Contestants Table */}
            <div className="bg-[#26201E] rounded-3xl border border-[#3E3531] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1D1817] text-[#AFA39B] uppercase font-bold tracking-wider border-b border-[#3E3531]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredContestants.length > 0 && selectedContestantIds.size === filteredContestants.length}
                          onChange={handleSelectAllContestants}
                          className="w-4 h-4 rounded accent-[#F6AC67] cursor-pointer"
                          title="Select or deselect all contestants"
                        />
                      </th>
                      <th className="py-3 px-4"># Number</th>
                      <th className="py-3 px-4">Photo</th>
                      <th className="py-3 px-4">Name / Nickname</th>
                      <th className="py-3 px-4">Nama IG (@...)</th>
                      <th className="py-3 px-4">No. Telepon (Internal)</th>
                      <th className="py-3 px-4 text-right">Exact Votes</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#342D2A]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-[#AFA39B]">
                          Loading contestant data...
                        </td>
                      </tr>
                    ) : filteredContestants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-[#AFA39B]">
                          No contestants found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredContestants.map((c) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-[#2F2725] transition-colors ${
                            selectedContestantIds.has(c.id) ? 'bg-[#F6AC67]/10' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedContestantIds.has(c.id)}
                              onChange={() => handleToggleSelectContestant(c.id)}
                              className="w-4 h-4 rounded accent-[#F6AC67] cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-['Cinzel'] font-bold text-sm text-[#D8B37A]">
                            {c.numberDisplay}
                          </td>
                          <td className="py-3 px-4">
                            <img
                              src={mediaUrl(c.imageUrl)}
                              alt={c.name}
                              className="w-10 h-12 rounded-lg object-cover bg-[#171413]"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                              }}
                            />
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#F7F0EA]">
                            {c.name}
                            {c.isDemo && (
                              <span className="ml-2 text-[9px] bg-[#3E3531] text-[#AFA39B] px-1.5 py-0.5 rounded font-mono">
                                demo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-medium text-[#F6AC67] bg-[#342D2A] px-2 py-0.5 rounded-lg border border-[#4A3F39]">
                              <svg className="w-3 h-3 text-[#F6AC67]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                              </svg>
                              {c.instagram || (c.costume.startsWith('@') ? c.costume : `@${c.costume}`)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {c.phoneNumber ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] text-[#F7F0EA]">{c.phoneNumber}</span>
                                <a
                                  href={`https://wa.me/${c.phoneNumber.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 transition-colors"
                                  title="Hubungi via WhatsApp"
                                >
                                  WA
                                </a>
                              </div>
                            ) : (
                              <span className="text-[#AFA39B] italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-['Cinzel'] font-bold text-sm text-[#F6AC67]">
                            {c.votes}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                c.isActive
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-[#3E3531] text-[#AFA39B] border border-[#4A3F39]'
                              }`}
                            >
                              {c.isActive ? 'Active' : 'Hidden'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openEditModal(c)}
                                className="p-1.5 rounded-lg bg-[#342D2A] hover:bg-[#3E3531] text-[#D8B37A] hover:text-[#F6AC67] transition-colors cursor-pointer"
                                title="Edit Contestant"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>

                              <button
                                onClick={() => handleToggleHide(c)}
                                className="p-1.5 rounded-lg bg-[#342D2A] hover:bg-[#3E3531] text-[#AFA39B] hover:text-[#F7F0EA] transition-colors cursor-pointer"
                                title={c.isActive ? 'Hide Contestant' : 'Unhide Contestant'}
                              >
                                {c.isActive ? (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>

                              <button
                                onClick={() => setContestantToDelete(c)}
                                className="p-1.5 rounded-lg bg-[#342D2A] hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                title="Delete Contestant"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* SECTION 2: VOTING CONTROL */}
        {activeSection === 'voting_control' && (
          <main className="p-4 sm:p-6 flex-1 space-y-6 max-w-4xl">
            {/* Primary Start / Close Voting Action Card */}
            <div className="p-6 rounded-3xl bg-[#26201E] border border-[#3E3531] shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <span className="text-[10px] font-bold text-[#F6AC67] tracking-widest uppercase block">
                  EVENT STATUS CONTROL
                </span>
                <h3 className="font-['Cinzel'] text-xl font-black text-[#F7F0EA] mt-1">
                  {currentOutletObj?.name} Ballot Collection
                </h3>
                <p className="text-xs text-[#AFA39B] mt-1 max-w-md leading-relaxed">
                  {currentOutletObj?.votingActive
                    ? 'Voting is OPEN. Venue guests can scan table QR codes and cast ballots for active contestants.'
                    : 'Voting is CLOSED. Guests can inspect contestants and view the leaderboard, but cannot cast new ballots.'}
                </p>
              </div>

              <button
                onClick={() => setConfirmVotingToggle(true)}
                className={`py-3 px-6 rounded-2xl font-black text-xs tracking-widest uppercase transition-all shadow-xl cursor-pointer flex-shrink-0 ${
                  currentOutletObj?.votingActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/50'
                }`}
              >
                {currentOutletObj?.votingActive ? 'CLOSE VOTING NOW' : 'ACTIVATE VOTING'}
              </button>
            </div>

            {/* Voting Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Total Venue Votes
                </span>
                <div className="text-2xl font-['Cinzel'] font-black text-[#F6AC67] mt-1">
                  {currentOutletObj?.totalVotes || 0}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Active Contestants
                </span>
                <div className="text-2xl font-['Cinzel'] font-black text-[#F7F0EA] mt-1">
                  {contestants.filter((c) => c.isActive).length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#2A2422] border border-[#3E3531]">
                <span className="text-[10px] text-[#AFA39B] uppercase font-bold tracking-wider">
                  Duplicate Lock Enforced
                </span>
                <div className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  1 Vote / Identity Session
                </div>
              </div>
            </div>

            {/* Audit Log Trail */}
            <div className="bg-[#26201E] rounded-3xl border border-[#3E3531] p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#342D2A] mb-4">
                <div>
                  <h4 className="font-['Cinzel'] text-sm font-bold text-[#F7F0EA] uppercase">
                    Audit Trail — {currentOutletObj?.name}
                  </h4>
                  <p className="text-[11px] text-[#AFA39B]">
                    Immutable log of all cast ballots and administrative modifications.
                  </p>
                </div>
                <button
                  onClick={() => loadAudit(selectedOutlet)}
                  className="px-3 py-1 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#D8B37A] hover:text-[#F6AC67] cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              <div className="divide-y divide-[#342D2A] max-h-80 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#AFA39B]">No audit events logged yet.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono ${
                              log.action === 'VOTE_CAST'
                                ? 'bg-amber-950 text-[#F6AC67]'
                                : log.action === 'CONTESTANT_DELETED'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-[#3E3531] text-[#D8B37A]'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="font-bold text-[#F7F0EA]">{log.actor}</span>
                        </div>
                        <p className="text-[#AFA39B] mt-1 text-[11px]">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-[#AFA39B] font-mono flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </main>
        )}

        {/* SECTION 3: LEADERBOARD & QR */}
        {activeSection === 'leaderboard_qr' && (
          <main className="p-4 sm:p-6 flex-1 space-y-6">
            <div>
              <h3 className="font-['Cinzel'] text-lg font-bold text-[#F7F0EA] tracking-wider uppercase">
                VENUE LEADERBOARD & QR PRINT PACKS
              </h3>
              <p className="text-xs text-[#AFA39B] mt-1">
                Launch the stage 16:9 LED display or download printable high-resolution venue QR codes for table tents and bar counters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Guest Mobile Vote QR */}
              <div className="p-5 rounded-3xl bg-[#26201E] border border-[#3E3531] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#F6AC67] tracking-widest uppercase block">
                    FOR GUEST TABLE CARDS
                  </span>
                  <h4 className="font-bold text-base text-[#F7F0EA] mt-1">
                    Guest Voting Ballot QR
                  </h4>
                  <p className="text-xs text-[#AFA39B] mt-1">
                    Direct link to `/vote/{selectedOutlet}`. Guests see all contestants for this outlet and cast their 1 vote.
                  </p>
                </div>

                <div className="my-6 flex justify-center">
                  <button
                    onClick={() =>
                      openQrModal(
                        appUrl(`/vote/${selectedOutlet}`),
                        `Guest Voting QR — ${currentOutletObj?.name}`
                      )
                    }
                    className="p-3 bg-[#F6AC67] rounded-2xl shadow-xl hover:scale-105 transition-transform cursor-pointer"
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        typeof window !== 'undefined' ? appUrl(`/vote/${selectedOutlet}`) : ''
                      )}&bgcolor=F6AC67&color=211D1C&margin=1`}
                      alt="Guest Voting QR"
                      className="w-36 h-36 rounded-lg object-contain"
                    />
                  </button>
                </div>

                <button
                  onClick={() =>
                    openQrModal(
                      appUrl(`/vote/${selectedOutlet}`),
                      `Guest Voting QR — ${currentOutletObj?.name}`
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] text-xs font-bold text-[#D8B37A] hover:text-[#F6AC67] transition-colors cursor-pointer"
                >
                  Download Printable QR
                </button>
              </div>

              {/* Card 2: Public Mobile Leaderboard QR */}
              <div className="p-5 rounded-3xl bg-[#26201E] border border-[#3E3531] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#D8B37A] tracking-widest uppercase block">
                    FOR VENUE BAR & HOSTESS
                  </span>
                  <h4 className="font-bold text-base text-[#F7F0EA] mt-1">
                    Live Mobile Standings QR
                  </h4>
                  <p className="text-xs text-[#AFA39B] mt-1">
                    Direct link to `/leaderboard/{selectedOutlet}`. Read-only live rankings with top 3 podium spotlight and exact vote counts.
                  </p>
                </div>

                <div className="my-6 flex justify-center">
                  <button
                    onClick={() =>
                      openQrModal(
                        appUrl(`/leaderboard/${selectedOutlet}`),
                        `Live Leaderboard QR — ${currentOutletObj?.name}`
                      )
                    }
                    className="p-3 bg-[#D8B37A] rounded-2xl shadow-xl hover:scale-105 transition-transform cursor-pointer"
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        typeof window !== 'undefined' ? appUrl(`/leaderboard/${selectedOutlet}`) : ''
                      )}&bgcolor=D8B37A&color=211D1C&margin=1`}
                      alt="Leaderboard QR"
                      className="w-36 h-36 rounded-lg object-contain"
                    />
                  </button>
                </div>

                <button
                  onClick={() =>
                    openQrModal(
                      appUrl(`/leaderboard/${selectedOutlet}`),
                      `Live Leaderboard QR — ${currentOutletObj?.name}`
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] text-xs font-bold text-[#D8B37A] hover:text-[#F6AC67] transition-colors cursor-pointer"
                >
                  Download Printable QR
                </button>
              </div>

              {/* Card 3: 16:9 Stage LED Display */}
              <div className="p-5 rounded-3xl bg-[#26201E] border border-[#3E3531] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#AFA39B] tracking-widest uppercase block">
                    FOR VENUE AV & STAGE VJ
                  </span>
                  <h4 className="font-bold text-base text-[#F7F0EA] mt-1">
                    Stage 16:9 LED Display
                  </h4>
                  <p className="text-xs text-[#AFA39B] mt-1">
                    Fullscreen 16:9 venue screen `/display/{selectedOutlet}` with top-3 podium and paginated lower grid.
                  </p>
                </div>

                <div className="my-6 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#1E1A19] border border-[#3E3531]">
                  <span className="font-['Cinzel'] font-bold text-sm text-[#F6AC67]">
                    16:9 LED STAGE FEED
                  </span>
                  <p className="text-[11px] text-[#AFA39B] mt-1">
                    Auto-updates in real time with smooth rank movement.
                  </p>
                </div>

                <a
                  href={withBase(`/display/${selectedOutlet}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] text-xs font-extrabold tracking-wider uppercase text-center transition-all cursor-pointer shadow"
                >
                  Launch Stage LED View
                </a>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Confirmation Modal for Start / Close Voting */}
      {confirmVotingToggle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm bg-[#2A2422] border border-[#D8B37A]/50 rounded-3xl p-6 shadow-2xl text-center">
            <h3 className="font-['Cinzel'] text-lg font-bold text-[#F7F0EA] uppercase mb-2">
              {currentOutletObj?.votingActive ? 'Close Venue Voting?' : 'Open Venue Voting?'}
            </h3>
            <p className="text-xs text-[#AFA39B] mb-5 leading-relaxed">
              {currentOutletObj?.votingActive
                ? `Are you sure you want to CLOSE voting for ${currentOutletObj?.name}? Guests will no longer be able to cast new ballots.`
                : `Are you sure you want to ACTIVATE voting for ${currentOutletObj?.name}? Guests will be able to cast ballots immediately.`}
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmVotingToggle(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeToggleVoting}
                className={`w-1/2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer ${
                  currentOutletObj?.votingActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contestant Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-lg bg-[#2A2422] border border-[#4A3F39] rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E3531] mb-4">
              <h3 className="font-['Cinzel'] text-base font-bold text-[#F7F0EA] tracking-wider uppercase">
                {editingContestant
                  ? `EDIT CONTESTANT ${editingContestant.numberDisplay}`
                  : `NEW CONTESTANT (#${nextNumber.toString().padStart(2, '0')})`}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveContestant} noValidate className="space-y-4 text-xs">
              {/* Photo Upload & Preview with Rotate Helper */}
              <div>
                <label className="block text-[11px] font-bold text-[#D8B37A] uppercase tracking-wider mb-2">
                  Contestant Photo (Portrait 3:4 or 4:5 recommended)
                </label>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative w-32 h-40 rounded-2xl overflow-hidden bg-[#1D1817] border border-[#4A3F39] flex items-center justify-center flex-shrink-0">
                    {formImageUrl ? (
                      <img
                        src={mediaUrl(formImageUrl)}
                        alt="Preview"
                        style={{ transform: `rotate(${uploadRotation}deg)` }}
                        className="w-full h-full object-cover transition-transform"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-[#AFA39B] text-center px-2">
                        No photo selected
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="py-2 px-3 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] border border-[#4A3F39] text-[#F7F0EA] font-semibold cursor-pointer"
                      >
                        {isUploading ? 'Uploading...' : 'Upload From Phone / PC'}
                      </button>

                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={handleRotatePhoto}
                          className="py-2 px-3 rounded-xl bg-[#342D2A] hover:bg-[#3E3531] border border-[#4A3F39] text-[#D8B37A] font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Rotate 90°
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-[#AFA39B]">
                      Or provide an image URL / Upload path:
                    </p>
                    <input
                      type="text"
                      placeholder="https://... or /uploads/..."
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      className="w-full bg-[#1D1817] border border-[#4A3F39] rounded-xl p-2 text-xs text-[#F7F0EA] focus:outline-none focus:border-[#D8B37A]"
                    />
                  </div>
                </div>
              </div>

              {/* Name, Instagram & Phone Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#D8B37A] uppercase tracking-wider mb-1">
                    Contestant Name / Nickname *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jessica 'Siren'"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#1D1817] border border-[#4A3F39] rounded-xl p-2.5 text-xs text-[#F7F0EA] focus:outline-none focus:border-[#D8B37A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#D8B37A] uppercase tracking-wider mb-1">
                    Akun Instagram / Nama IG (@...) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. @jessica_siren"
                      value={formCostume}
                      onChange={(e) => setFormCostume(e.target.value)}
                      className="w-full bg-[#1D1817] border border-[#4A3F39] rounded-xl p-2.5 text-xs text-[#F7F0EA] focus:outline-none focus:border-[#D8B37A]"
                    />
                  </div>
                </div>
              </div>

              {/* Dedicated Internal Phone Number Field */}
              <div className="p-3 rounded-2xl bg-[#211D1C] border border-[#3E3531]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-bold text-[#D8B37A] uppercase tracking-wider">
                    Nomor Telepon / WhatsApp (Khusus Data Internal)
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                    🔒 Tidak Muncul di Voting
                  </span>
                </div>
                <input
                  type="tel"
                  placeholder="e.g. 0812-3456-7890"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-[#171413] border border-[#4A3F39] rounded-xl p-2.5 text-xs text-[#F7F0EA] focus:outline-none focus:border-[#D8B37A]"
                />
                <p className="text-[10px] text-[#AFA39B] mt-1.5 leading-tight">
                  Nomor telepon ini tersimpan aman di backend staff saja untuk pendataan pemenang hadiah dan verifikasi internal, <strong className="text-[#D8B37A]">tidak akan pernah ditampilkan</strong> kepada publik voting maupun layar LED panggung.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-[#D8B37A] uppercase tracking-wider mb-1">
                  Costume Details / Background (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about craftsmanship, design inspiration..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#1D1817] border border-[#4A3F39] rounded-xl p-2 text-xs text-[#F7F0EA] focus:outline-none focus:border-[#D8B37A]"
                />
              </div>

              {/* Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConsent}
                    onChange={(e) => setFormConsent(e.target.checked)}
                    className="mt-0.5 rounded accent-[#F6AC67]"
                  />
                  <span className="text-[11px] text-[#AFA39B] leading-tight">
                    I confirm that the contestant has consented to photography and public display on Black Owl Halloween voting boards.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#3E3531]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2.5 px-5 rounded-xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] text-xs font-extrabold tracking-wider uppercase shadow cursor-pointer disabled:opacity-50"
                >
                  {editingContestant ? 'Save Changes' : 'Register Contestant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {contestantToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm bg-[#2A2422] border border-rose-900/60 rounded-3xl p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="font-['Cinzel'] text-base font-bold text-[#F7F0EA] uppercase mb-1">
              Delete Contestant?
            </h3>
            <p className="text-xs text-[#AFA39B] mb-4">
              Are you sure you want to permanently remove {contestantToDelete.numberDisplay} - {contestantToDelete.name}?
              This action will be recorded in the audit log.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setContestantToDelete(null)}
                className="w-1/2 py-2.5 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isConfirmBulkDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm bg-[#2A2422] border border-rose-900/60 rounded-3xl p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <h3 className="font-['Cinzel'] text-base font-bold text-[#F7F0EA] uppercase mb-1">
              Delete {selectedContestantIds.size} Contestant{selectedContestantIds.size > 1 ? 's' : ''}?
            </h3>
            <p className="text-xs text-[#AFA39B] mb-4">
              Are you sure you want to permanently delete {selectedContestantIds.size} selected contestant(s) from {currentOutletObj?.name || selectedOutlet}? This action will be recorded in the audit log.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmBulkDeleteOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDeleteContestants}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? 'Deleting...' : 'Confirm Bulk Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Venue / Outlet Modal */}
      {isResetOutletModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm bg-[#2A2422] border border-rose-600/60 rounded-3xl p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="font-['Cinzel'] text-base font-bold text-[#F7F0EA] uppercase mb-1">
              Reset {selectedOutlet} to 0?
            </h3>
            <p className="text-xs text-[#AFA39B] mb-3">
              Tindakan ini akan menghapus permanen seluruh kontestan terdaftar untuk <strong className="text-[#F6AC67]">{currentOutletObj?.name || selectedOutlet}</strong> dan mengembalikan total suara ke <strong className="text-[#F6AC67]">0</strong>.
            </p>

            <div className="mb-4 text-left bg-[#1D1817] p-3 rounded-2xl border border-[#4A3F39]">
              <label htmlFor="confirm-reset-code" className="block text-[11px] text-[#AFA39B] mb-1 text-center">
                Ketik <strong className="text-[#F6AC67] font-mono">{selectedOutlet}</strong> untuk konfirmasi:
              </label>
              <input
                id="confirm-reset-code"
                type="text"
                value={resetConfirmationInput}
                onChange={(e) => setResetConfirmationInput(e.target.value.toUpperCase())}
                placeholder={`Ketik ${selectedOutlet}`}
                className="w-full bg-[#26201E] border border-[#4A3F39] text-center font-mono font-bold tracking-widest text-[#F7F0EA] rounded-xl p-2 text-xs focus:outline-none focus:border-rose-500 uppercase"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsResetOutletModalOpen(false);
                  setResetConfirmationInput('');
                }}
                className="w-1/2 py-2.5 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isResettingOutlet || resetConfirmationInput.trim() !== selectedOutlet}
                onClick={handleResetCurrentOutlet}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResettingOutlet ? 'Mereset...' : 'Ya, Reset ke 0'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Printable Modal */}
      {qrModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-sm bg-[#342D2A] border border-[#D8B37A]/50 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <h3 className="font-['Cinzel'] text-base font-bold text-[#F7F0EA] uppercase mb-1">
              {qrModalTitle}
            </h3>
            <p className="text-xs text-[#D8B37A] font-mono break-all mb-4 px-2">
              {qrModalUrl}
            </p>

            {generatedQrDataUrl && (
              <div className="p-3 bg-[#F6AC67] rounded-2xl shadow-xl mb-4">
                <img
                  src={generatedQrDataUrl}
                  alt="QR Code"
                  className="w-56 h-56 rounded-lg object-contain"
                />
              </div>
            )}

            <div className="w-full flex flex-col gap-2">
              {generatedQrDataUrl && (
                <a
                  href={generatedQrDataUrl}
                  download={`black-owl-${selectedOutlet}-qr.png`}
                  className="w-full py-2.5 rounded-xl bg-[#F6AC67] text-[#211D1C] font-black text-xs uppercase tracking-wider shadow text-center cursor-pointer"
                >
                  Download High-Res PNG
                </a>
              )}
              <button
                onClick={() => setQrModalUrl(null)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff & Admin Management Modal (Super Admin only) */}
      {isStaffModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-2xl max-h-[90vh] bg-[#26201E] border border-[#D8B37A]/40 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#342D2A]">
              <div>
                <h3 className="font-['Cinzel'] text-lg font-bold text-[#F7F0EA] tracking-wide flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#F6AC67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Authorized Staff & Admins
                </h3>
                <p className="text-xs text-[#AFA39B] mt-0.5">
                  Invite staff members by email and assign Super Admin or Outlet Admin permissions.
                </p>
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#342D2A] text-[#AFA39B] hover:text-[#F7F0EA] hover:bg-[#4A3F39] flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
              {/* Form: Add New Admin */}
              <div className="p-4 rounded-2xl bg-[#342D2A] border border-[#4A3F39]/60">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#F6AC67] mb-3">
                  + Add New Authorized Staff
                </h4>
                <form onSubmit={handleAddStaff} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#AFA39B] uppercase font-bold block mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Pratama"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-[#211D1C] text-xs text-[#F7F0EA] rounded-xl px-3 py-2 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#AFA39B] uppercase font-bold block mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. alex@blackowl.id"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        className="w-full bg-[#211D1C] text-xs text-[#F7F0EA] rounded-xl px-3 py-2 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#AFA39B] uppercase font-bold block mb-1">
                        Role
                      </label>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as any)}
                        className="w-full bg-[#211D1C] text-xs text-[#F7F0EA] rounded-xl px-3 py-2 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                      >
                        <option value="OUTLET_ADMIN">Outlet Admin (Single Outlet)</option>
                        <option value="SUPER_ADMIN">Super Admin (All Outlets & Head Office)</option>
                      </select>
                    </div>

                    {newStaffRole === 'OUTLET_ADMIN' && (
                      <div>
                        <label className="text-[10px] text-[#AFA39B] uppercase font-bold block mb-1">
                          Assigned Outlet
                        </label>
                        <select
                          value={newStaffOutlet}
                          onChange={(e) => setNewStaffOutlet(e.target.value as any)}
                          className="w-full bg-[#211D1C] text-xs text-[#F7F0EA] rounded-xl px-3 py-2 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                        >
                          {outlets.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.code} — {o.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-[#AFA39B] uppercase font-bold">
                        Custom Security PIN / Password (Optional)
                      </label>
                      <span className="text-[10px] text-[#D8B37A]">Default: 2026</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 8821 or budi789 (leave blank to use default 2026)"
                      value={newStaffPin}
                      onChange={(e) => setNewStaffPin(e.target.value)}
                      className="w-full bg-[#211D1C] text-xs text-[#F7F0EA] rounded-xl px-3 py-2 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                    />
                    <p className="text-[10px] text-[#AFA39B]/70 mt-1">
                      Beri PIN/password khusus untuk staff ini (misal Budi), atau kosongkan untuk memakai default 2026.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingStaff}
                    className="w-full py-2.5 rounded-xl bg-[#F6AC67] hover:bg-[#e6984e] text-[#211D1C] font-black text-xs uppercase tracking-wider transition-colors shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isAddingStaff ? 'Adding...' : 'Grant Admin Access'}
                  </button>
                </form>
              </div>

              {/* List: Existing Authorized Staff */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#AFA39B] mb-2 px-1">
                  Active Authorized Staff ({allowedStaff.length})
                </h4>
                <div className="space-y-2">
                  {allowedStaff.map((staff) => {
                    const isOwner = staff.email.toLowerCase() === 'heryanjojo@gmail.com';
                    const isEditingThisPin = editingPinEmail === staff.email;
                    return (
                      <div
                        key={staff.email}
                        className="p-3 rounded-2xl bg-[#342D2A]/60 border border-[#4A3F39]/50 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-[#F7F0EA]">{staff.name}</span>
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                  staff.role === 'SUPER_ADMIN'
                                    ? 'bg-[#F6AC67]/20 text-[#F6AC67] border-[#F6AC67]/40'
                                    : 'bg-[#D8B37A]/20 text-[#D8B37A] border-[#D8B37A]/40'
                                }`}
                              >
                                {staff.role === 'SUPER_ADMIN' ? 'Super Admin' : `Admin (${staff.assignedOutlet})`}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#AFA39B] font-mono block truncate">
                              {staff.email}
                            </span>
                          </div>

                          <div>
                            {isOwner ? (
                              <span className="text-[10px] text-[#D8B37A] font-semibold uppercase px-2 py-1">
                                Owner
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRemoveStaff(staff.email)}
                                className="text-[10px] text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>

                        {/* PIN Display & Edit */}
                        {isEditingThisPin ? (
                          <div className="mt-1 p-2.5 rounded-xl bg-[#211D1C] border border-[#F6AC67]/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <span className="text-[10px] text-[#D8B37A] font-bold uppercase whitespace-nowrap">
                              New PIN:
                            </span>
                            <input
                              type="text"
                              value={editingPinValue}
                              onChange={(e) => setEditingPinValue(e.target.value)}
                              placeholder="e.g. 8821 (or blank for default 2026)"
                              className="flex-1 bg-[#1A1615] text-xs text-[#F7F0EA] rounded-lg px-2.5 py-1.5 border border-[#4A3F39] focus:outline-none focus:border-[#F6AC67]"
                            />
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                disabled={isSavingPin}
                                onClick={() => handleSavePin(staff.email)}
                                className="px-2.5 py-1 rounded-lg bg-[#F6AC67] hover:bg-[#e6984e] text-[#211D1C] font-bold text-[10px] uppercase cursor-pointer"
                              >
                                {isSavingPin ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPinEmail(null)}
                                className="px-2 py-1 rounded-lg bg-[#342D2A] text-[#AFA39B] hover:text-[#F7F0EA] text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1 border-t border-[#4A3F39]/40">
                            <span className="text-[10px] text-[#AFA39B]">Login PIN:</span>
                            <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#211D1C] text-[#F6AC67] border border-[#4A3F39]/60 font-bold">
                              {staff.pin ? staff.pin : '2026 (Default)'}
                            </code>
                            <button
                              onClick={() => {
                                setEditingPinEmail(staff.email);
                                setEditingPinValue(staff.pin || '');
                              }}
                              className="text-[10px] text-[#D8B37A] hover:text-[#f8b678] underline cursor-pointer ml-1"
                            >
                              Edit PIN
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#342D2A] flex justify-end">
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#AFA39B] hover:text-[#F7F0EA] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
