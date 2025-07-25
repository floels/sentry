import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import type {
  DatasetSource,
  DiscoverDatasets,
  SavedQueryDatasets,
} from 'sentry/utils/discover/types';
import type {WidgetType} from 'sentry/views/dashboards/types';

import type {Actor, Avatar, ObjectStatus, Scope} from './core';
import type {ExternalTeam} from './integrations';
import type {OnboardingTaskStatus} from './onboarding';
import type {Project} from './project';
import type {Relay} from './relay';
import type {User} from './user';

/**
 * Organization summaries are sent when you request a list of all organizations
 */
export interface OrganizationSummary {
  avatar: Avatar;
  codecovAccess: boolean;
  dateCreated: string;
  features: string[];
  githubNudgeInvite: boolean;
  githubOpenPRBot: boolean;
  githubPRBot: boolean;
  gitlabPRBot: boolean;
  hideAiFeatures: boolean;
  id: string;
  isEarlyAdopter: boolean;
  issueAlertsThreadFlag: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  metricAlertsThreadFlag: boolean;
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: ObjectStatus;
    name: string;
  };
}

/**
 * Detailed organization (e.g. when requesting details for a single org)
 */
export interface Organization extends OrganizationSummary {
  access: Scope[];
  aggregatedDataConsent: boolean;
  alertsMemberWrite: boolean;
  allowJoinRequests: boolean;
  allowMemberInvite: boolean;
  allowMemberProjectCreation: boolean;
  allowSharedIssues: boolean;
  allowSuperuserAccess: boolean;
  attachmentsRole: string;
  /** @deprecated use orgRoleList instead. */
  availableRoles: Array<{id: string; name: string}>;
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  debugFilesRole: string;
  defaultRole: string;
  enhancedPrivacy: boolean;
  eventsMemberAdmin: boolean;
  genAIConsent: boolean;
  isDefault: boolean;
  isDynamicallySampled: boolean;
  onboardingTasks: OnboardingTaskStatus[];
  openMembership: boolean;
  /**
   * A list of roles that are available to the organization.
   * eg: billing, admin, member, manager, owner
   */
  orgRoleList: OrgRole[];
  pendingAccessRequests: number;
  quota: {
    accountLimit: number | null;
    maxRate: number | null;
    maxRateInterval: number | null;
    projectLimit: number | null;
  };
  relayPiiConfig: string | null;
  requiresSso: boolean;
  safeFields: string[];
  samplingMode: 'organization' | 'project';
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  storeCrashReports: number;
  streamlineOnly: boolean | null;
  targetSampleRate: number;
  teamRoleList: TeamRole[];
  trustedRelays: Relay[];
  defaultAutofixAutomationTuning?:
    | 'off'
    | 'super_low'
    | 'low'
    | 'medium'
    | 'high'
    | 'always'
    | null;
  defaultSeerScannerAutomation?: boolean;
  desiredSampleRate?: number | null;
  effectiveSampleRate?: number | null;
  extraOptions?: {
    traces: {
      checkSpanExtractionDate: boolean;
      spansExtractionDate: number;
    };
  };
  orgRole?: string;
  planSampleRate?: number | null;
}

export interface Team {
  access: Scope[];
  avatar: Avatar;
  externalTeams: ExternalTeam[];
  flags: {
    'idp:provisioned': boolean;
  };
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
}

export interface DetailedTeam extends Team {
  projects: Project[];
}

export interface BaseRole {
  desc: string;
  id: string;
  name: string;
  isAllowed?: boolean;
  isRetired?: boolean;
  isTeamRolesAllowed?: boolean;
}
export interface OrgRole extends BaseRole {
  minimumTeamRole: string;
  isGlobal?: boolean;
  /**
   * @deprecated use isGlobal
   */
  is_global?: boolean;
}
export interface TeamRole extends BaseRole {
  isMinimumRoleFor: string;
}

/**
 * Returned from /organizations/org/users/
 */
export interface Member {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: 'approved' | 'requested_to_be_invited' | 'requested_to_join';
  invite_link: string | null;
  inviterName: string | null;
  isOnlyOwner: boolean;
  name: string;
  orgRole: OrgRole['id'];
  orgRoleList: OrgRole[];
  pending: boolean | undefined;
  projects: string[];
  /**
   * @deprecated use orgRole
   */
  role: OrgRole['id'];
  roleName: string;
  /**
   * @deprecated use orgRoleList
   */
  roles: OrgRole[];
  teamRoleList: TeamRole[];

  // TODO: Move to global store
  teamRoles: Array<{
    role: string | null;
    teamSlug: string;
  }>;
  /**
   * @deprecated use teamRoles
   */
  teams: string[];
  // # Deprecated, use teamRoles
  /**
   * User may be null when the member represents an invited member
   */
  user: User | null;
}

/**
 * Returned from TeamMembersEndpoint
 */
export interface TeamMember extends Member {
  teamRole?: string | null;
  teamSlug?: string;
}

/**
 * Users that exist in CommitAuthors but are not members of the organization.
 * These users commit to repos installed for the organization.
 */
export interface MissingMember {
  commitCount: number;
  email: string;
  // The user's ID in the repository provider (e.g. Github username)
  externalId: string;
}

/**
 * Minimal organization shape used on shared issue views.
 */
export type SharedViewOrganization = {
  slug: string;
  features?: string[];
  id?: string;
};

export type AuditLog = {
  actor: User;
  data: any;
  dateCreated: string;
  event: string;
  id: string;
  ipAddress: string;
  note: string;
  targetObject: number;
  targetUser: Actor | null;
};

export type AccessRequest = {
  id: string;
  member: Member;
  team: Team;
  requester?: Partial<{
    email: string;
    name: string;
    username: string;
  }>;
};

/**
 * Discover queries and result sets.
 */
export type SavedQueryVersions = 1 | 2;

export interface NewQuery {
  fields: readonly string[];
  name: string;
  version: SavedQueryVersions;
  createdBy?: User;
  dataset?: DiscoverDatasets;
  datasetSource?: DatasetSource;
  display?: string;
  end?: string | Date;
  environment?: readonly string[];
  expired?: boolean;
  id?: string;
  interval?: string;
  multiSort?: boolean;
  orderby?: string | string[];
  projects?: readonly number[];
  query?: string;
  queryDataset?: SavedQueryDatasets;
  range?: string;
  start?: string | Date;
  teams?: ReadonlyArray<'myteams' | number>;
  topEvents?: string;
  utc?: boolean | string;
  widths?: readonly string[];
  yAxis?: string[];
}

export interface SavedQuery extends NewQuery {
  dateCreated: string;
  dateUpdated: string;
  id: string;
}

export type Confidence = 'high' | 'low' | null;

export type EventsStatsData = Array<
  [number, Array<{count: number; comparisonCount?: number}>]
>;

type ConfidenceStatsData = Array<[number, Array<{count: Confidence}>]>;

type AccuracyStatsItem<T> = {
  timestamp: number;
  value: T;
};

export type AccuracyStats<T> = Array<AccuracyStatsItem<T>>;

// API response for a single Discover timeseries
export type EventsStats = {
  data: EventsStatsData;
  confidence?: ConfidenceStatsData; // deprecated
  end?: number;
  isExtrapolatedData?: boolean;
  isMetricsData?: boolean;
  isMetricsExtractedData?: boolean;
  meta?: {
    fields: Record<string, AggregationOutputType>;
    isMetricsData: boolean;
    tips: {columns?: string; query?: string};
    units: Record<string, string | null>;
    accuracy?: {
      confidence?: AccuracyStats<Confidence>;
      sampleCount?: AccuracyStats<number>;
      // 0 sample count can result in null sampling rate
      samplingRate?: AccuracyStats<number | null>;
    };
    dataScanned?: 'full' | 'partial';
    dataset?: string;
    datasetReason?: string;
    discoverSplitDecision?: WidgetType;
    isMetricsExtractedData?: boolean;
  };
  order?: number;
  start?: number;
  totals?: {count: number};
};

// API response for a top N Discover series or a multi-axis Discover series
export type MultiSeriesEventsStats = Record<string, EventsStats>;

// API response for a grouped top N Discover series
export type GroupedMultiSeriesEventsStats = Record<
  string,
  {
    [seriesName: string]: EventsStats | number;
    order: number;
  }
>;

export type EventsStatsSeries<F extends string> = {
  data: Array<{
    axis: F;
    values: number[];
    label?: string;
  }>;
  meta: {
    dataset: string;
    end: number;
    start: number;
  };
  timestamps: number[];
};

/**
 * Session API types.
 */
// Base type for series style API response
export interface SeriesApi {
  groups: Array<{
    by: Record<string, string | number>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }>;
  intervals: string[];
}

export interface SessionApiResponse extends SeriesApi {
  end: string;
  query: string;
  start: string;
}

export enum SessionFieldWithOperation {
  SESSIONS = 'sum(session)',
  USERS = 'count_unique(user)',
  DURATION = 'p50(session.duration)',
  CRASH_FREE_RATE_USERS = 'crash_free_rate(user)',
  CRASH_FREE_RATE_SESSIONS = 'crash_free_rate(session)',
}

export enum SessionStatus {
  HEALTHY = 'healthy',
  ABNORMAL = 'abnormal',
  ERRORED = 'errored',
  CRASHED = 'crashed',
}

interface IssuesMetricsTimeseries {
  axis: 'new_issues_count' | 'resolved_issues_count' | 'new_issues_count_by_release';
  groupBy: string[];
  meta: {
    interval: number;
    isOther: boolean;
    order: number;
    valueType: string;
    valueUnit: null | string;
  };
  values: Array<{
    timestamp: number;
    value: number;
  }>;
}

export interface IssuesMetricsApiResponse {
  meta: {
    dataset: string;
    end: number;
    start: number;
  };
  timeseries: IssuesMetricsTimeseries[];
}
