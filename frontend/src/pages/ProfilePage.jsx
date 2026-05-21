import { useRef, useState } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateUserProfile } from "../lib/api";
import {
  CameraIcon,
  ImageIcon,
  LinkIcon,
  LoaderIcon,
  MapPinIcon,
  SaveIcon,
  ShuffleIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { LANGUAGES } from "../constants";

/* ─── helpers ───────────────────────────────────────────────── */

/**
 * Compress an image File to a base64 JPEG string.
 * Max dimension: 400 × 400 px, quality 0.82
 */
const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (evt) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;

        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

/* ─── component ─────────────────────────────────────────────── */

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [formState, setFormState] = useState({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    location: authUser?.location || "",
    profilePic: authUser?.profilePic || "",
  });

  const [picUrlInput, setPicUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const { mutate: updateMutation, isPending } = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update profile");
    },
  });

  /* ── handlers ── */

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation(formState);
  };

  // Reliable avatar styles from DiceBear (no auth, no CORS issues)
  const AVATAR_STYLES = ["adventurer", "avataaars", "big-ears", "bottts", "fun-emoji", "lorelei", "micah", "miniavs", "personas", "pixel-art", "thumbs"];

  const handleRandomAvatar = () => {
    const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    const seed = Math.random().toString(36).substring(2, 10);
    const randomAvatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    setFormState({ ...formState, profilePic: randomAvatar });
    toast.success("Random avatar generated!");
    setShowUrlInput(false);
  };

  const handleUrlSubmit = () => {
    if (picUrlInput.trim()) {
      setFormState({ ...formState, profilePic: picUrlInput.trim() });
      setPicUrlInput("");
      setShowUrlInput(false);
      toast.success("Picture URL applied!");
    }
  };

  /* Gallery / file upload */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // guard: images only
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // guard: raw file size < 10 MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB");
      return;
    }

    try {
      setIsCompressing(true);
      const base64 = await compressImage(file);
      setFormState({ ...formState, profilePic: base64 });
      toast.success("Photo selected! Click Save Changes to apply.");
    } catch {
      toast.error("Could not read image, please try another file");
    } finally {
      setIsCompressing(false);
      // reset input so same file can be re-selected
      e.target.value = "";
    }
  };

  const isBusy = isPending || isCompressing;

  return (
    <div className="min-h-screen bg-base-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <UserIcon className="size-8 text-primary" />
            Profile Settings
          </h1>
          <p className="text-base-content/60 mt-1">
            Update your profile information and preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Profile Picture Card ── */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-lg mb-4">Profile Picture</h2>

              <div className="flex flex-col sm:flex-row items-center gap-6">

                {/* Avatar preview — clicking it opens the file picker */}
                {/*
                  FIX: outer wrapper is size-28 + relative so overlay's inset-0
                  maps exactly to the circle. Overlay is a SIBLING of the circle
                  (not a child) so overflow:hidden on the circle doesn't interfere.
                */}
                <div className="relative size-28 flex-shrink-0 group">
                  {/* Circle */}
                  <div
                    className="size-28 rounded-full overflow-hidden bg-base-300
                                ring-4 ring-primary/30 transition-all group-hover:ring-primary cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    title="Click to upload photo"
                  >
                    {isCompressing ? (
                      <div className="flex items-center justify-center h-full">
                        <LoaderIcon className="size-8 animate-spin text-primary" />
                      </div>
                    ) : formState.profilePic ? (
                      <img
                        src={formState.profilePic}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // final fallback: inline SVG so it never stays blank
                          e.target.onerror = null;
                          e.target.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234b5563'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='90' rx='30' ry='22' fill='%239ca3af'/%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <CameraIcon className="size-10 text-base-content/30" />
                      </div>
                    )}
                  </div>

                  {/* Hover overlay — sibling of circle, perfectly aligned via inset-0 on the size-28 wrapper */}
                  <div
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0
                                group-hover:opacity-100 transition-opacity
                                flex items-center justify-center cursor-pointer pointer-events-none"
                  >
                    <CameraIcon className="size-8 text-white drop-shadow" />
                  </div>

                  <p className="absolute -bottom-6 left-0 right-0 text-xs text-center text-base-content/40">
                    Click to upload
                  </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-3 flex-1 w-full">

                  {/* ★ Upload from gallery */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-primary btn-sm gap-2"
                    disabled={isCompressing}
                  >
                    {isCompressing ? (
                      <LoaderIcon className="size-4 animate-spin" />
                    ) : (
                      <ImageIcon className="size-4" />
                    )}
                    {isCompressing ? "Processing…" : "Upload from Gallery"}
                  </button>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Random avatar */}
                  <button
                    type="button"
                    onClick={handleRandomAvatar}
                    className="btn btn-accent btn-sm gap-2"
                  >
                    <ShuffleIcon className="size-4" />
                    Generate Random Avatar
                  </button>

                  {/* Image URL */}
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="btn btn-outline btn-sm gap-2"
                  >
                    <LinkIcon className="size-4" />
                    Use Image URL
                  </button>

                  {showUrlInput && (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={picUrlInput}
                        onChange={(e) => setPicUrlInput(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="input input-bordered input-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleUrlSubmit}
                        className="btn btn-primary btn-sm"
                      >
                        Set
                      </button>
                    </div>
                  )}

                  {/* Remove */}
                  {formState.profilePic && (
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, profilePic: "" })}
                      className="btn btn-ghost btn-sm text-error gap-2"
                    >
                      <XIcon className="size-4" />
                      Remove Picture
                    </button>
                  )}

                  <p className="text-xs text-base-content/40">
                    Supported: JPG, PNG, GIF, WebP · Max 10 MB
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Personal Info ── */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body space-y-4">
              <h2 className="card-title text-lg">Personal Information</h2>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Full Name</span>
                </label>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Bio</span>
                </label>
                <textarea
                  value={formState.bio}
                  onChange={(e) => setFormState({ ...formState, bio: e.target.value })}
                  className="textarea textarea-bordered h-24 resize-none"
                  placeholder="Tell others about yourself and your language learning goals…"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Location</span>
                </label>
                <div className="relative">
                  <MapPinIcon className="absolute top-1/2 -translate-y-1/2 left-3 size-4 text-base-content/50" />
                  <input
                    type="text"
                    value={formState.location}
                    onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                    className="input input-bordered w-full pl-10"
                    placeholder="City, Country"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Languages ── */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body space-y-4">
              <h2 className="card-title text-lg">Language Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Native Language</span>
                  </label>
                  <select
                    value={formState.nativeLanguage}
                    onChange={(e) => setFormState({ ...formState, nativeLanguage: e.target.value })}
                    className="select select-bordered w-full"
                  >
                    <option value="">Select native language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={`native-${lang}`} value={lang.toLowerCase()}>{lang}</option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Learning Language</span>
                  </label>
                  <select
                    value={formState.learningLanguage}
                    onChange={(e) => setFormState({ ...formState, learningLanguage: e.target.value })}
                    className="select select-bordered w-full"
                  >
                    <option value="">Select learning language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={`learning-${lang}`} value={lang.toLowerCase()}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Account ── */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-lg">Account Information</h2>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email Address</span>
                </label>
                <input
                  type="email"
                  value={authUser?.email || ""}
                  className="input input-bordered w-full opacity-60"
                  disabled
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Email cannot be changed</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Save ── */}
          <button
            type="submit"
            className="btn btn-primary w-full gap-2"
            disabled={isBusy}
          >
            {isPending ? (
              <><LoaderIcon className="animate-spin size-5" />Saving Changes…</>
            ) : (
              <><SaveIcon className="size-5" />Save Changes</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
