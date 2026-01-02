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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  DollarSign,
  Zap,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CostData {
  summary: {
    totalCostCents: number;
    totalCalls: number;
    avgCostPerCall: number;
    days: number;
  };
  byClient: {
    clientId: string | null;
    clientName: string | null;
    totalCostCents: number;
    callCount: number;
    avgDurationMs: number;
  }[];
  byModel: {
    provider: string;
    model: string | null;
    totalCostCents: number;
    callCount: number;
    avgDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  }[];
  byEndpoint: {
    endpoint: string | null;
    totalCostCents: number;
    callCount: number;
    avgDurationMs: number;
    successRate: number;
  }[];
  recentCalls: {
    id: string;
    provider: string;
    model: string | null;
    endpoint: string | null;
    costCents: number;
    durationMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    success: boolean;
    createdAt: string;
    clientName: string | null;
    interviewId: string | null;
  }[];
}

const formatCost = (cents: number) => {
  return `$${(cents / 100).toFixed(4)}`;
};

const formatDuration = (ms: number | null) => {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export default function AdminCostsPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, refetch, isRefetching } = useQuery<CostData>({
    queryKey: ["admin-costs", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch costs");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Costs</h1>
          <p className="text-gray-500 mt-1">
            Track API usage and costs across all interviews
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No API usage data available yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Start running interviews to see cost tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCost(data.summary.totalCostCents)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Last {data.summary.days} days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                <Zap className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {data.summary.totalCalls.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Total requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Call</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCost(data.summary.avgCostPerCall)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Per API request
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Avg</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCost(data.summary.totalCostCents / data.summary.days)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cost per day
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tabs */}
          <Tabs defaultValue="by-model" className="space-y-4">
            <TabsList>
              <TabsTrigger value="by-model">By Model</TabsTrigger>
              <TabsTrigger value="by-client">By Client</TabsTrigger>
              <TabsTrigger value="by-endpoint">By Endpoint</TabsTrigger>
              <TabsTrigger value="recent">Recent Calls</TabsTrigger>
            </TabsList>

            <TabsContent value="by-model">
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Model</CardTitle>
                  <CardDescription>
                    API usage breakdown by provider and model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.byModel.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No model usage data yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Provider</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Input Tokens</TableHead>
                          <TableHead className="text-right">Output Tokens</TableHead>
                          <TableHead className="text-right">Avg Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byModel.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline">{row.provider}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {row.model || "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCost(row.totalCostCents)}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.callCount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.totalInputTokens?.toLocaleString() || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.totalOutputTokens?.toLocaleString() || "-"}
                            </TableCell>
                            <TableCell className="text-right text-gray-500">
                              {formatDuration(row.avgDurationMs)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-client">
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Client</CardTitle>
                  <CardDescription>
                    API costs attributed to each client
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.byClient.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No client usage data yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">API Calls</TableHead>
                          <TableHead className="text-right">Avg Duration</TableHead>
                          <TableHead className="text-right">Cost/Call</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byClient.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {row.clientName || "Unassigned"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCost(row.totalCostCents)}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.callCount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-gray-500">
                              {formatDuration(row.avgDurationMs)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCost(row.totalCostCents / row.callCount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-endpoint">
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Endpoint</CardTitle>
                  <CardDescription>
                    API usage by endpoint/feature
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.byEndpoint.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No endpoint usage data yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Endpoint</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Success Rate</TableHead>
                          <TableHead className="text-right">Avg Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byEndpoint.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {row.endpoint || "unknown"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCost(row.totalCostCents)}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.callCount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={row.successRate >= 95 ? "default" : "destructive"}
                                className={row.successRate >= 95 ? "bg-green-100 text-green-800" : ""}
                              >
                                {row.successRate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-gray-500">
                              {formatDuration(row.avgDurationMs)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recent">
              <Card>
                <CardHeader>
                  <CardTitle>Recent API Calls</CardTitle>
                  <CardDescription>
                    Last 100 API requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.recentCalls.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No recent API calls
                    </p>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Provider/Model</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.recentCalls.map((call) => (
                            <TableRow key={call.id}>
                              <TableCell className="text-gray-500 text-sm">
                                {new Date(call.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">{call.provider}</span>
                                  <span className="font-mono text-sm">{call.model || "-"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {call.endpoint || "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {call.clientName || "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">
                                {formatCost(call.costCents)}
                              </TableCell>
                              <TableCell className="text-right text-gray-500">
                                {formatDuration(call.durationMs)}
                              </TableCell>
                              <TableCell>
                                {call.success ? (
                                  <Badge className="bg-green-100 text-green-800">OK</Badge>
                                ) : (
                                  <Badge variant="destructive">Error</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Pricing Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">API Pricing Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Claude 3 Haiku</p>
                  <p className="text-gray-500">$0.25/1M in, $1.25/1M out</p>
                </div>
                <div>
                  <p className="font-medium">Claude 3.5 Sonnet</p>
                  <p className="text-gray-500">$3/1M in, $15/1M out</p>
                </div>
                <div>
                  <p className="font-medium">HeyGen Streaming</p>
                  <p className="text-gray-500">$0.10/min</p>
                </div>
                <div>
                  <p className="font-medium">Deepgram Nova-2</p>
                  <p className="text-gray-500">$0.0077/min streaming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
