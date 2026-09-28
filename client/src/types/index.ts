export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  currencySymbol: string;
  accentColor: string;
  theme: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'BANK' | 'CASH' | 'WALLET' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';
  openingBalancePaise: number;
  currentBalancePaise: number;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  icon: string;
  color: string;
  isSystem: boolean;
}

export interface TransactionSplit {
  id: string;
  transactionId: string;
  categoryId: string;
  amountPaise: number;
  notes?: string;
  category?: Category;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  tripId?: string;
  goalId?: string;
  loanId?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'LEND' | 'BORROW' | 'LOAN_REPAYMENT' | 'TRIP_EXPENSE' | 'GOAL_CONTRIBUTION';
  amountPaise: number;
  date: string;
  description: string;
  notes?: string;
  person?: string;
  tags?: string;
  receiptUrl?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  status: string;
  account?: Account;
  toAccount?: Account;
  category?: Category;
  splits?: TransactionSplit[];
}

export interface Budget {
  id: string;
  userId: string;
  categoryId?: string;
  period: string;
  amountPaise: number;
  alertThresholdPercent: number;
  startDate: string;
  endDate?: string;
  category?: Category;
  currentSpentPaise: number;
  prevSpentPaise: number;
  remainingPaise: number;
  isOverBudget: boolean;
  overAmountPaise: number;
  percentage: number;
  dailyRecommendedPaise: number;
  historicalChangePct: number;
  daysRemainingInMonth: number;
}

export interface TripCalculation {
  targetBudgetPaise: number;
  savedAmountPaise: number;
  remainingPaise: number;
  percentageSaved: number;
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  requiredDailySavingPaise: number;
  requiredWeeklySavingPaise: number;
  requiredMonthlySavingPaise: number;
  currentPaceDailyPaise: number;
  projectedTotalSavingsPaise: number;
  shortfallOrSurplusPaise: number;
  isOnTrack: boolean;
  statusMessage: string;
  recommendation: string;
}

export interface TripBudgetCategory {
  id: string;
  tripId: string;
  category: string;
  estimatedPaise: number;
  actualPaise: number;
}

export interface TripExpense {
  id: string;
  tripId: string;
  category: string;
  amountPaise: number;
  date: string;
  description: string;
  paidBy: string;
  receiptUrl?: string;
}

export interface Trip {
  id: string;
  userId: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  currency: string;
  targetBudgetPaise: number;
  savedAmountPaise: number;
  status: string;
  notes?: string;
  coverImage?: string;
  categories: TripBudgetCategory[];
  expenses: TripExpense[];
  calculation?: TripCalculation;
  totalActualExpensePaise?: number;
  totalEstimatedPaise?: number;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amountPaise: number;
  date: string;
  notes?: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  category: string;
  targetAmountPaise: number;
  currentAmountPaise: number;
  targetDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  color: string;
  icon: string;
  notes?: string;
  remainingPaise: number;
  percentage: number;
  diffDays: number;
  monthsRemaining: number;
  requiredMonthlyPaise: number;
  computedStatus: string;
  contributions?: GoalContribution[];
}

export interface LoanPayment {
  id: string;
  loanId: string;
  amountPaise: number;
  principalPartPaise: number;
  interestPartPaise: number;
  date: string;
  notes?: string;
}

export interface Loan {
  id: string;
  userId: string;
  type: 'LENT' | 'BORROWED';
  person: string;
  principalPaise: number;
  remainingPaise: number;
  interestRate: number;
  date: string;
  dueDate?: string;
  purpose: string;
  notes?: string;
  status: string;
  computedStatus: string;
  totalPaidPaise: number;
  payments?: LoanPayment[];
  receipts?: Receipt[];
}

export interface LoansSummary {
  loans: Loan[];
  lentList: Loan[];
  borrowedList: Loan[];
  totalLentPaise: number;
  totalReceivedPaise: number;
  outstandingReceivablePaise: number;
  totalBorrowedPaise: number;
  totalRepaidPaise: number;
  outstandingPayablePaise: number;
  overdueList: Loan[];
  overdueAmountPaise: number;
  activeCount: number;
}

export interface ReceiptEmail {
  id: string;
  receiptId: string;
  userId: string;
  recipientEmail: string;
  recipientName?: string;
  customMessage?: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  userId: string;
  loanId: string;
  repaymentId?: string;
  receiptNumber: string;
  verificationId: string;
  type: 'LOAN_LENT' | 'LOAN_BORROWED' | 'REPAYMENT' | 'SETTLEMENT';
  amountPaise: number;
  currency: string;
  pdfStorageKey?: string;
  metadata: string; // JSON string
  createdAt: string;
  updatedAt: string;
  emailHistory?: ReceiptEmail[];
}

export interface FinancialReceiptData {
  receiptNumber: string;
  verificationId: string;
  type: string;
  amountPaise: number;
  formattedAmount?: string;
  currency?: string;
  person: string;
  purpose?: string;
  principalPaise?: number;
  principalPaidPaise?: number;
  remainingPaise?: number;
  interestPaise?: number;
  interestRate?: number;
  dueDate?: string | null;
  status?: string;
  notes?: string | null;
  date?: string;
  issuedAt?: string;
  isVerified?: boolean;
}


export interface Bill {
  id: string;
  userId: string;
  name: string;
  amountPaise: number;
  frequency: string;
  dueDate: string;
  nextDueDate: string;
  category: string;
  accountId?: string;
  autoRenew: boolean;
  reminderDays: number;
  status: string;
  diffDays: number;
  computedStatus: string;
  account?: Account;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AIInsight {
  id: string;
  userId: string;
  type: string;
  title: string;
  explanation: string;
  period: string;
  supportingData: string;
  confidence: number;
  suggestedAction: string;
  actionPayload?: string;
  isDismissed: boolean;
  createdAt: string;
}

export interface DashboardData {
  summary: {
    totalBalancePaise: number;
    monthlyIncomePaise: number;
    monthlyExpensesPaise: number;
    availableToSpendPaise: number;
    incomeChangePct: number;
    expenseChangePct: number;
  };
  health: {
    score: number;
    breakdown: {
      savings: number;
      budgetControl: number;
      debt: number;
      consistency: number;
    };
    explanation: string;
    disclaimer: string;
  };
  cashFlow: {
    days30: Array<{ date: string; income: number; expenses: number; net: number }>;
    months6: Array<{ month: string; income: number; expenses: number; net: number }>;
  };
  spendingBreakdown: Array<{
    categoryId: string;
    name: string;
    color: string;
    valueRupees: number;
    amountPaise: number;
    percentage: number;
  }>;
  budgets: Array<{
    id: string;
    categoryName: string;
    icon: string;
    color: string;
    allocatedPaise: number;
    spentPaise: number;
    percent: number;
    isOver: boolean;
  }>;
  tripWidget: {
    id: string;
    name: string;
    destination: string;
    startDate: string;
    targetBudgetPaise: number;
    savedAmountPaise: number;
    calculation: TripCalculation;
  } | null;
  lendBorrow: {
    totalReceivablePaise: number;
    totalPayablePaise: number;
    activeLoansCount: number;
  };
  upcomingPayments: Array<{
    id: string;
    name: string;
    amountPaise: number;
    nextDueDate: string;
    category: string;
    frequency: string;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    type: string;
    amountPaise: number;
    date: string;
    accountName: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
  }>;
  aiInsights: AIInsight[];
}
