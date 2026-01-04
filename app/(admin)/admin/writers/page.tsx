"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  UserPlus,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Writer {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  assignmentsCount: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
}

interface Interview {
  id: string;
  title: string | null;
  clientName: string | null;
  mode: string;
  status: string;
  completedAt: string | null;
}

export default function WritersPage() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);

  // Form state for new writer
  const [newWriter, setNewWriter] = useState({
    email: "",
    name: "",
    password: "",
  });

  // Form state for assignment
  const [assignmentData, setAssignmentData] = useState({
    interviewId: "",
    notes: "",
  });

  // Fetch writers
  const { data: writers, isLoading: writersLoading } = useQuery<Writer[]>({
    queryKey: ["writers"],
    queryFn: async () => {
      const res = await fetch("/api/writers");
      if (!res.ok) throw new Error("Failed to fetch writers");
      return res.json();
    },
  });

  // Fetch completed interviews for assignment
  const { data: interviews } = useQuery<Interview[]>({
    queryKey: ["interviews-completed"],
    queryFn: async () => {
      const res = await fetch("/api/interviews?status=completed");
      if (!res.ok) throw new Error("Failed to fetch interviews");
      const data = await res.json();
      return data.filter((i: Interview) => i.status === "completed");
    },
    enabled: isAssignDialogOpen,
  });

  // Create writer mutation
  const createWriter = useMutation({
    mutationFn: async (data: typeof newWriter) => {
      const res = await fetch("/api/writers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create writer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writers"] });
      setIsAddDialogOpen(false);
      setNewWriter({ email: "", name: "", password: "" });
      toast.success("Writer created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create assignment mutation
  const createAssignment = useMutation({
    mutationFn: async (data: { interviewId: string; writerId: string; notes: string }) => {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create assignment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writers"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setIsAssignDialogOpen(false);
      setSelectedWriter(null);
      setAssignmentData({ interviewId: "", notes: "" });
      toast.success("Interview assigned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreateWriter = () => {
    if (!newWriter.email || !newWriter.password) {
      toast.error("Email and password are required");
      return;
    }
    createWriter.mutate(newWriter);
  };

  const handleAssignInterview = () => {
    if (!assignmentData.interviewId || !selectedWriter) {
      toast.error("Please select an interview");
      return;
    }
    createAssignment.mutate({
      interviewId: assignmentData.interviewId,
      writerId: selectedWriter.id,
      notes: assignmentData.notes,
    });
  };

  if (writersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Writers</h1>
          <p className="text-gray-500 mt-1">Manage content writers and assignments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Writer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Writer</DialogTitle>
              <DialogDescription>
                Create a new writer account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newWriter.name}
                  onChange={(e) =>
                    setNewWriter({ ...newWriter, name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newWriter.email}
                  onChange={(e) =>
                    setNewWriter({ ...newWriter, email: e.target.value })
                  }
                  placeholder="writer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newWriter.password}
                  onChange={(e) =>
                    setNewWriter({ ...newWriter, password: e.target.value })
                  }
                  placeholder="Secure password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateWriter}
                disabled={createWriter.isPending}
              >
                {createWriter.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Writer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Writers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{writers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {writers?.reduce((sum, w) => sum + w.assignmentsCount.pending, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {writers?.reduce((sum, w) => sum + w.assignmentsCount.inProgress, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {writers?.reduce((sum, w) => sum + w.assignmentsCount.completed, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Writers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Writers</CardTitle>
          <CardDescription>
            View and manage writer accounts and their assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!writers?.length ? (
            <div className="text-center py-8 text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No writers yet</p>
              <p className="text-sm">Add your first writer to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {writers.map((writer) => (
                  <TableRow key={writer.id}>
                    <TableCell className="font-medium">
                      {writer.name || "Unnamed"}
                    </TableCell>
                    <TableCell>{writer.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-yellow-600">
                          {writer.assignmentsCount.pending} pending
                        </Badge>
                        <Badge variant="outline" className="text-blue-600">
                          {writer.assignmentsCount.inProgress} active
                        </Badge>
                        <Badge variant="outline" className="text-green-600">
                          {writer.assignmentsCount.completed} done
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={writer.isActive ? "default" : "secondary"}>
                        {writer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(writer.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWriter(writer);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Interview Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Interview to {selectedWriter?.name || selectedWriter?.email}</DialogTitle>
            <DialogDescription>
              Select a completed interview to assign for content creation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="interview">Select Interview *</Label>
              <Select
                value={assignmentData.interviewId}
                onValueChange={(value) =>
                  setAssignmentData({ ...assignmentData, interviewId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an interview" />
                </SelectTrigger>
                <SelectContent>
                  {interviews?.map((interview) => (
                    <SelectItem key={interview.id} value={interview.id}>
                      <span className="flex items-center gap-2">
                        {interview.clientName && (
                          <span className="font-medium">{interview.clientName}</span>
                        )}
                        <span className="text-gray-500">
                          {interview.completedAt
                            ? new Date(interview.completedAt).toLocaleDateString()
                            : interview.title || `Interview ${interview.id.slice(0, 8)}`}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes for Writer</Label>
              <Textarea
                id="notes"
                value={assignmentData.notes}
                onChange={(e) =>
                  setAssignmentData({ ...assignmentData, notes: e.target.value })
                }
                placeholder="Any specific instructions or focus areas..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedWriter(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignInterview}
              disabled={createAssignment.isPending}
            >
              {createAssignment.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Assign Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
