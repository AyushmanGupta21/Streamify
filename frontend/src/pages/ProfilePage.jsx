import { useState } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateUserProfile } from "../lib/api";
import {
  CameraIcon,
  LoaderIcon,
  MapPinIcon,
  ShuffleIcon,
  UserIcon,
  SaveIcon,
  LinkIcon,
} from "lucide-react";
import { LANGUAGES } from "../constants";

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

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

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation(formState);
  };

  const handleRandomAvatar = () => {
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;
    setFormState({ ...formState, profilePic: randomAvatar });
    toast.success("Random avatar generated!");
  };

  const handleUrlSubmit = () => {
    if (picUrlInput.trim()) {
      setFormState({ ...formState, profilePic: picUrlInput.trim() });
      setPicUrlInput("");
      setShowUrlInput(false);
      toast.success("Profile picture URL set!");
    }
  };

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
          {/* Profile Picture Card */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-lg mb-4">Profile Picture</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Avatar Preview */}
                <div className="relative group">
                  <div className="size-28 rounded-full overflow-hidden bg-base-300 ring-4 ring-primary/30">
                    {formState.profilePic ? (
                      <img
                        src={formState.profilePic}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://avatar.iran.liara.run/public/1.png`;
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <CameraIcon className="size-10 text-base-content/30" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Picture Controls */}
                <div className="flex flex-col gap-3 flex-1 w-full">
                  <button
                    type="button"
                    onClick={handleRandomAvatar}
                    className="btn btn-accent btn-sm gap-2"
                  >
                    <ShuffleIcon className="size-4" />
                    Generate Random Avatar
                  </button>

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

                  {formState.profilePic && (
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, profilePic: "" })}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      Remove Picture
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Info Card */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body space-y-4">
              <h2 className="card-title text-lg">Personal Information</h2>

              {/* Full Name */}
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

              {/* Bio */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Bio</span>
                </label>
                <textarea
                  value={formState.bio}
                  onChange={(e) => setFormState({ ...formState, bio: e.target.value })}
                  className="textarea textarea-bordered h-24 resize-none"
                  placeholder="Tell others about yourself and your language learning goals..."
                />
              </div>

              {/* Location */}
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

          {/* Language Card */}
          <div className="card bg-base-200 shadow-md">
            <div className="card-body space-y-4">
              <h2 className="card-title text-lg">Language Preferences</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Native Language */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Native Language</span>
                  </label>
                  <select
                    value={formState.nativeLanguage}
                    onChange={(e) =>
                      setFormState({ ...formState, nativeLanguage: e.target.value })
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="">Select native language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={`native-${lang}`} value={lang.toLowerCase()}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Learning Language */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Learning Language</span>
                  </label>
                  <select
                    value={formState.learningLanguage}
                    onChange={(e) =>
                      setFormState({ ...formState, learningLanguage: e.target.value })
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="">Select learning language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={`learning-${lang}`} value={lang.toLowerCase()}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Read-only Info */}
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
                  <span className="label-text-alt text-base-content/50">
                    Email cannot be changed
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="btn btn-primary w-full gap-2"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <LoaderIcon className="animate-spin size-5" />
                Saving Changes...
              </>
            ) : (
              <>
                <SaveIcon className="size-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
