// Twitter API service using twitterapi.io
// Docs: https://twitterapi.io/docs

const TWITTER_API_BASE = "https://api.twitterapi.io";

interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  author: {
    username: string;
    name: string;
    followersCount: number;
  };
}

interface TwitterApiResponse {
  tweets: Tweet[];
  has_next_page?: boolean;
  next_cursor?: string;
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
      const errorText = await response.text();
      console.error(`Twitter API error: ${response.status}`, errorText);
      return [];
    }

    const data = await response.json();

    // twitterapi.io nests tweets under data.tweets
    const tweets = data.data?.tweets || data.tweets || [];
    console.log(`[Twitter] Fetched ${tweets.length} tweets for @${username}`);

    if (!Array.isArray(tweets) || tweets.length === 0) {
      console.error("[Twitter] No tweets found. Response:", JSON.stringify(data).slice(0, 300));
      return [];
    }

    return tweets;
  } catch (error) {
    console.error("Failed to fetch tweets:", error);
    return [];
  }
}

export function calculateEngagement(tweet: Tweet): number {
  // Use flat metric fields from twitterapi.io response
  return (
    (tweet.likeCount || 0) +
    (tweet.retweetCount || 0) * 2 +
    (tweet.replyCount || 0) * 1.5 +
    (tweet.quoteCount || 0) * 2.5
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
    if (!tweet.text) return;

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
    console.log(`[Twitter] No tweets found for @${username}`);
    return null;
  }

  const topTweets = analyzeTopTweets(tweets, 5);
  const avgEngagement =
    tweets.reduce((sum, t) => sum + calculateEngagement(t), 0) / tweets.length;
  const topics = extractTopics(tweets);

  console.log(`[Twitter] Scraped @${username}: ${tweets.length} tweets, ${topics.length} topics, avg engagement: ${Math.round(avgEngagement)}`);

  return {
    tweets,
    topTweets,
    avgEngagement: Math.round(avgEngagement),
    topics,
    followerCount: tweets[0]?.author?.followersCount || 0,
  };
}
