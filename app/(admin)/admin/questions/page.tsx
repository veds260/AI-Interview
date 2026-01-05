"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Wand2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "origin_story", label: "Origin Story" },
  { value: "failure_story", label: "Failure Story" },
  { value: "success_story", label: "Success Story" },
  { value: "turning_point", label: "Turning Point" },
  { value: "hot_take", label: "Hot Take" },
  { value: "contrarian_view", label: "Contrarian View" },
  { value: "industry_critique", label: "Industry Critique" },
  { value: "prediction", label: "Prediction" },
  { value: "technical", label: "Technical Deep Dive" },
  { value: "framework", label: "Framework" },
  { value: "how_to", label: "How-To" },
  { value: "lessons", label: "Lessons Learned" },
  { value: "values", label: "Values" },
  { value: "habits", label: "Habits" },
  { value: "influences", label: "Influences" },
  { value: "advice", label: "Advice" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "deep", label: "Deep" },
];

interface Question {
  id: string;
  question: string;
  category: string | null;
  difficulty: string | null;
  topics: string[] | null;
  expectedClipPotential: number | null;
  web2Friendly: boolean | null;
  timesUsed: number | null;
  isActive: boolean;
}

export default function QuestionsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    question: "",
    category: "",
    difficulty: "medium",
    topics: "",
    expectedClipPotential: "7",
    web2Friendly: false,
  });

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["questions"],
    queryFn: async () => {
      const res = await fetch("/api/questions");
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          topics: data.topics.split(",").map((t) => t.trim()).filter(Boolean),
          expectedClipPotential: parseInt(data.expectedClipPotential),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create question");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      setIsOpen(false);
      setFormData({
        question: "",
        category: "",
        difficulty: "medium",
        topics: "",
        expectedClipPotential: "7",
        web2Friendly: false,
      });
      toast.success("Question added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate questions");
      }
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success("Questions generated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const getCategoryLabel = (value: string | null) => {
    if (!value) return "-";
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Question Bank</h1>
          <p className="text-muted-foreground mt-1">
            Manage interview questions by category
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateQuestions}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate with AI
              </>
            )}
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Question</DialogTitle>
                <DialogDescription>
                  Create a new interview question
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Question *</Label>
                  <Textarea
                    id="question"
                    placeholder="What's the story behind starting your company?"
                    value={formData.question}
                    onChange={(e) =>
                      setFormData({ ...formData, question: e.target.value })
                    }
                    required
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select
                      value={formData.difficulty}
                      onValueChange={(value) =>
                        setFormData({ ...formData, difficulty: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((diff) => (
                          <SelectItem key={diff.value} value={diff.value}>
                            {diff.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topics">Topics</Label>
                  <Input
                    id="topics"
                    placeholder="leadership, startup, fundraising (comma-separated)"
                    value={formData.topics}
                    onChange={(e) =>
                      setFormData({ ...formData, topics: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clipPotential">Clip Potential (1-10)</Label>
                    <Input
                      id="clipPotential"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.expectedClipPotential}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expectedClipPotential: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox
                      id="web2Friendly"
                      checked={formData.web2Friendly}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          web2Friendly: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="web2Friendly">Web2 Friendly</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Question"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Questions</CardTitle>
          <CardDescription>
            {questions.length} question{questions.length !== 1 ? "s" : ""} in
            bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No questions yet. Add questions manually or generate with AI.
              </p>
              <Button variant="outline" onClick={handleGenerateQuestions}>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Starter Questions
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Clip Potential</TableHead>
                  <TableHead>Web2</TableHead>
                  <TableHead>Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.question}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryLabel(q.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {q.difficulty || "-"}
                    </TableCell>
                    <TableCell>{q.expectedClipPotential || "-"}/10</TableCell>
                    <TableCell>
                      {q.web2Friendly ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>{q.timesUsed || 0}x</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
