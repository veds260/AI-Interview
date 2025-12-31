// Twitter API service using twitterapi.io
// Docs: https://twitterapi.io/docs

const TWITTER_API_BASE = "https://api.twitterapi.io";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  author: {
    username: string;
    name: string;
    followers_count: number;
  };
}

interface TwitterApiResponse {
  data: Tweet[];
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

export async function fetchUserTweets(
  username: string,
  count: number = 20
): Promise<Tweet[]> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;

  if (!apiKey) {
    console.warn("TWITTERAPI_IO_KEY not set, skipping Twitter fetch");
    return [];
  }

  try {
    const response = await fetch(
      `${TWITTER_API_BASE}/twitter/user/last_tweets?userName=${username}&count=${count}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`Twitter API error: ${response.status}`);
      return [];
    }

    const data: TwitterApiResponse = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch tweets:", error);
    return [];
  }
}

export function calculateEngagement(tweet: Tweet): number {
  const metrics = tweet.public_metrics;
  return (
    metrics.like_count +
    metrics.retweet_count * 2 +
    metrics.reply_count * 1.5 +
    metrics.quote_count * 2.5
  );
}

export function analyzeTopTweets(tweets: Tweet[], topN: number = 5) {
  const tweetsWithEngagement = tweets.map((tweet) => ({
    ...tweet,
    engagement: calculateEngagement(tweet),
  }));

  return tweetsWithEngagement
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, topN);
}

export function extractTopics(tweets: Tweet[]): string[] {
  const commonTopics: Record<string, number> = {};

  tweets.forEach((tweet) => {
    // Extract hashtags
    const hashtags = tweet.text.match(/#\w+/g) || [];
    hashtags.forEach((tag) => {
      const normalized = tag.toLowerCase();
      commonTopics[normalized] = (commonTopics[normalized] || 0) + 1;
    });

    // Extract common keywords (simple approach)
    const words = tweet.text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "") // Remove URLs
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .split(/\s+/)
      .filter((word) => word.length > 4);

    words.forEach((word) => {
      commonTopics[word] = (commonTopics[word] || 0) + 1;
    });
  });

  // Return top topics
  return Object.entries(commonTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);
}

export async function scrapeCompetitor(username: string) {
  const tweets = await fetchUserTweets(username, 50);

  if (tweets.length === 0) {
    return null;
  }

  const topTweets = analyzeTopTweets(tweets, 5);
  const avgEngagement =
    tweets.reduce((sum, t) => sum + calculateEngagement(t), 0) / tweets.length;
  const topics = extractTopics(tweets);

  return {
    tweets,
    topTweets,
    avgEngagement: Math.round(avgEngagement),
    topics,
    followerCount: tweets[0]?.author?.followers_count || 0,
  };
}
