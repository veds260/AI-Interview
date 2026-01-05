"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Save, Camera, X, Twitter, Linkedin, Globe } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ClientProfile {
  id: string;
  name: string;
  brandName: string | null;
  profilePicture: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  knowledgeBase: {
    bio?: string;
    talkingPoints?: string[];
  } | null;
  topicsOfExpertise: string[] | null;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    profilePicture: "",
    twitterHandle: "",
    linkedinUrl: "",
    websiteUrl: "",
    bio: "",
    topics: "",
  });

  // Fetch client profile
  const { data: profile, isLoading: profileLoading } = useQuery<ClientProfile>({
    queryKey: ["client-profile"],
    queryFn: async () => {
      const res = await fetch("/api/client/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: status === "authenticated",
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        brandName: profile.brandName || "",
        profilePicture: profile.profilePicture || "",
        twitterHandle: profile.twitterHandle || "",
        linkedinUrl: profile.linkedinUrl || "",
        websiteUrl: profile.websiteUrl || "",
        bio: profile.knowledgeBase?.bio || "",
        topics: profile.topicsOfExpertise?.join(", ") || profile.knowledgeBase?.talkingPoints?.join(", ") || "",
      });
    }
  }, [profile]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          brandName: data.brandName,
          profilePicture: data.profilePicture,
          twitterHandle: data.twitterHandle,
          linkedinUrl: data.linkedinUrl,
          websiteUrl: data.websiteUrl,
          bio: data.bio,
          topicsOfExpertise: data.topics,
        }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  // Handle profile picture upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Check file size (max 2MB for base64 storage)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData({ ...formData, profilePicture: result });
    };
    reader.readAsDataURL(file);
  };

  // Handle paste for profile picture
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            toast.error("Image must be less than 2MB");
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            setFormData({ ...formData, profilePicture: result });
            toast.success("Profile picture added from clipboard");
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateMutation.mutate(formData);
  };

  if (status === "loading" || profileLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get initials for default avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" onPaste={isEditing ? handlePaste : undefined}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and social media settings</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-foreground">Account Information</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your profile details shown on post mockups
              </CardDescription>
            </div>
            <Badge variant="premium" className="capitalize">
              {session?.user?.role || "client"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture Section */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              {formData.profilePicture ? (
                <img
                  src={formData.profilePicture}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center border-4 border-border">
                  <span className="text-2xl font-bold text-foreground">
                    {getInitials(formData.name || session?.user?.name || "U")}
                  </span>
                </div>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-6 h-6 text-foreground" />
                  </button>
                  {formData.profilePicture && (
                    <button
                      onClick={() => setFormData({ ...formData, profilePicture: "" })}
                      className="absolute -top-1 -right-1 p-1 bg-red-500 text-foreground rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg text-foreground">
                {formData.name || session?.user?.name || "User"}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {session?.user?.email}
              </p>
              {isEditing && (
                <p className="text-xs text-muted-foreground mt-2">
                  Click photo to change or paste image (Ctrl+V)
                </p>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand/Company</Label>
                  <Input
                    id="brandName"
                    value={formData.brandName}
                    onChange={(e) =>
                      setFormData({ ...formData, brandName: e.target.value })
                    }
                    placeholder="Your company name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterHandle" className="flex items-center gap-2">
                  <Twitter className="w-4 h-4" />
                  Twitter/X Username
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    id="twitterHandle"
                    value={formData.twitterHandle}
                    onChange={(e) =>
                      setFormData({ ...formData, twitterHandle: e.target.value.replace("@", "") })
                    }
                    placeholder="username"
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will be shown on your post mockups
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" />
                  LinkedIn URL
                </Label>
                <Input
                  id="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedinUrl: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </Label>
                <Input
                  id="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, websiteUrl: e.target.value })
                  }
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  placeholder="Tell us about yourself and your work"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics">Topics of Expertise</Label>
                <Input
                  id="topics"
                  value={formData.topics}
                  onChange={(e) =>
                    setFormData({ ...formData, topics: e.target.value })
                  }
                  placeholder="e.g., AI, startups, growth, marketing"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of topics you can speak about
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form to original profile data
                    if (profile) {
                      setFormData({
                        name: profile.name || "",
                        brandName: profile.brandName || "",
                        profilePicture: profile.profilePicture || "",
                        twitterHandle: profile.twitterHandle || "",
                        linkedinUrl: profile.linkedinUrl || "",
                        websiteUrl: profile.websiteUrl || "",
                        bio: profile.knowledgeBase?.bio || "",
                        topics: profile.topicsOfExpertise?.join(", ") || "",
                      });
                    }
                  }}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-border">
              {/* Display current info */}
              {(formData.twitterHandle || formData.linkedinUrl || formData.websiteUrl) && (
                <div className="flex flex-wrap gap-3">
                  {formData.twitterHandle && (
                    <Badge variant="outline" className="gap-1 border-border">
                      <Twitter className="w-3 h-3" />
                      @{formData.twitterHandle}
                    </Badge>
                  )}
                  {formData.linkedinUrl && (
                    <Badge variant="outline" className="gap-1 border-border">
                      <Linkedin className="w-3 h-3" />
                      LinkedIn
                    </Badge>
                  )}
                  {formData.websiteUrl && (
                    <Badge variant="outline" className="gap-1 border-border">
                      <Globe className="w-3 h-3" />
                      Website
                    </Badge>
                  )}
                </div>
              )}
              {formData.bio && (
                <p className="text-sm text-foreground">{formData.bio}</p>
              )}
              {formData.topics && (
                <div className="flex flex-wrap gap-2">
                  {formData.topics.split(",").map((topic, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {topic.trim()}
                    </Badge>
                  ))}
                </div>
              )}
              <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Interview Statistics</CardTitle>
          <CardDescription className="text-muted-foreground">Your interview activity summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-red-500">-</p>
              <p className="text-sm text-muted-foreground">Total Interviews</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-500">-</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-500">-</p>
              <p className="text-sm text-muted-foreground">Content Pieces</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
