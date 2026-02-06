/**
 * Circuit Breaker Pattern Implementation
 * Protege o sistema contra falhas em cascata em serviços externos
 */

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    failureThreshold: number; // Número de falhas para abrir o circuito
    resetTimeout: number;     // Tempo em ms para tentar fechar o circuito (Half-Open)
    requestTimeout?: number;  // Timeout da requisição (opcional)
}

export class CircuitBreaker {
    private state: CircuitBreakerState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;
    private nextAttempt = 0;

    private readonly failureThreshold: number;
    private readonly resetTimeout: number;

    constructor(private serviceName: string, options: CircuitBreakerOptions) {
        this.failureThreshold = options.failureThreshold;
        this.resetTimeout = options.resetTimeout;
    }

    async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
            } else {
                if (fallback) {
                    return fallback();
                }
                throw new Error(`[CircuitBreaker] Serviço ${this.serviceName} está indisponível (OPEN).`);
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            if (fallback) {
                return fallback();
            }
            throw error;
        }
    }

    private onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log(`[CircuitBreaker] Serviço ${this.serviceName} recuperado (CLOSED).`);
        }
    }

    private onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            console.warn(`[CircuitBreaker] Serviço ${this.serviceName} falhou ${this.failureCount} vezes. Circuito ABERTO até ${new Date(this.nextAttempt).toISOString()}`);
        }
    }
}
