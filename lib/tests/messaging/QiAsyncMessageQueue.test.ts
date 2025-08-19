/**
 * Tests for QiAsyncMessageQueue  
 * 
 * Comprehensive test suite for h2A-inspired async message queue using proper QiCore Result<T> patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { match } from '@qi/base';
import { 
  QiAsyncMessageQueue,
  QiMessageFactory,
  MessageType,
  MessagePriority,
  type QueueOptions
} from '@qi/agent/messaging';

describe('QiAsyncMessageQueue', () => {
  let queue: QiAsyncMessageQueue;
  let factory: QiMessageFactory;

  beforeEach(() => {
    queue = new QiAsyncMessageQueue();
    factory = new QiMessageFactory();
  });

  describe('constructor and options', () => {
    it('should create queue with default options', () => {
      const stateResult = queue.getState();
      
      match(
        state => {
          expect(state.started).toBe(false);
          expect(state.isDone).toBe(false);
          expect(state.hasError).toBe(false);
          expect(state.messageCount).toBe(0);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        stateResult
      );
    });

    it('should create queue with custom options', () => {
      const options: QueueOptions = {
        maxSize: 100,
        maxConcurrent: 5,
        messageTtl: 60000,
        priorityQueuing: false,
        autoCleanup: false,
        enableStats: false
      };
      
      const customQueue = new QiAsyncMessageQueue(options);
      const stateResult = customQueue.getState();
      
      match(
        state => {
          expect(state.started).toBe(false);
          expect(state.isDone).toBe(false);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        stateResult
      );
    });

    it('should call cleanup function on destroy', async () => {
      let cleanupCalled = false;
      
      const options: QueueOptions = {
        cleanupFn: async () => {
          cleanupCalled = true;
        }
      };
      
      const customQueue = new QiAsyncMessageQueue(options);
      const destroyResult = await customQueue.destroy();
      
      match(
        () => {
          expect(cleanupCalled).toBe(true);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        destroyResult
      );
    });
  });

  describe('basic enqueue/dequeue operations', () => {
    it('should enqueue and dequeue single message', async () => {
      const messageResult = factory.createUserInputMessage('test input', 'cli');
      
      match(
        async message => {
          const enqueueResult = queue.enqueue(message);
          
          match(
            async () => {
              const iterator = queue[Symbol.asyncIterator]();
              const nextResult = await iterator.next();
              
              expect(nextResult.done).toBe(false);
              expect(nextResult.value.id).toBe(message.id);
              expect(nextResult.value.type).toBe(MessageType.USER_INPUT);
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should handle multiple messages in order', async () => {
      const messages = [
        factory.createUserInputMessage('message 1', 'cli'),
        factory.createUserInputMessage('message 2', 'cli'),
        factory.createUserInputMessage('message 3', 'cli')
      ];

      // Enqueue all messages
      for (const messageResult of messages) {
        match(
          message => {
            const enqueueResult = queue.enqueue(message);
            match(
              () => {
                // Successfully enqueued
              },
              error => {
                throw new Error(`Enqueue failed: ${error.message}`);
              },
              enqueueResult
            );
          },
          error => {
            throw new Error(`Message creation failed: ${error.message}`);
          },
          messageResult
        );
      }

      // Signal done and collect results
      const doneResult = queue.done();
      match(
        () => {
          // Successfully marked as done
        },
        error => {
          throw new Error(`Done failed: ${error.message}`);
        },
        doneResult
      );

      const received = [];
      for await (const message of queue) {
        received.push(message);
      }

      expect(received).toHaveLength(3);
      expect(received[0].type).toBe(MessageType.USER_INPUT);
      expect(received[1].type).toBe(MessageType.USER_INPUT);
      expect(received[2].type).toBe(MessageType.USER_INPUT);
    });

    it('should respect priority ordering when enabled', () => {
      const priorityQueue = new QiAsyncMessageQueue({ priorityQueuing: true });
      
      const lowPriority = factory.createUserInputMessage('low', 'cli');
      const highPriority = factory.createSystemControlMessage('pause');
      const criticalPriority = factory.createSystemControlMessage('shutdown');

      const allSuccessful = match(
        low => match(
          high => match(
            critical => true,
            () => false,
            criticalPriority
          ),
          () => false,
          highPriority
        ),
        () => false,
        lowPriority
      );

      expect(allSuccessful).toBe(true);
      
      if (allSuccessful) {
        match(
          lowMsg => {
            match(
              highMsg => {
                match(
                  criticalMsg => {
                    const enqueueResults = [
                      priorityQueue.enqueue(lowMsg),
                      priorityQueue.enqueue(highMsg),
                      priorityQueue.enqueue(criticalMsg)
                    ];

                    // All enqueues should succeed
                    for (const result of enqueueResults) {
                      match(
                        () => {
                          // Successfully enqueued
                        },
                        error => {
                          throw new Error(`Enqueue failed: ${error.message}`);
                        },
                        result
                      );
                    }

                    // Check priority order by peeking
                    const peekResult = priorityQueue.peek();
                    match(
                      message => {
                        expect(message?.priority).toBe(MessagePriority.HIGH);
                      },
                      error => {
                        throw new Error(`Peek failed: ${error.message}`);
                      },
                      peekResult
                    );
                  },
                  error => {
                    throw new Error(`Critical message creation failed: ${error.message}`);
                  },
                  criticalPriority
                );
              },
              error => {
                throw new Error(`High message creation failed: ${error.message}`);
              },
              highPriority
            );
          },
          error => {
            throw new Error(`Low message creation failed: ${error.message}`);
          },
          lowPriority
        );
      }
    });
  });

  describe('async iteration patterns', () => {
    it('should support async iteration with for-await', async () => {
      const messageResult = factory.createUserInputMessage('test', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            () => {
              // Successfully enqueued
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );

      const doneResult = queue.done();
      match(
        () => {
          // Successfully marked as done
        },
        error => {
          throw new Error(`Done failed: ${error.message}`);
        },
        doneResult
      );

      const received = [];
      for await (const message of queue) {
        received.push(message);
      }

      expect(received).toHaveLength(1);
    });

    it('should handle real-time message injection', async () => {
      const messageResult = factory.createUserInputMessage('initial', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            () => {
              // Successfully enqueued initial message
            },
            error => {
              throw new Error(`Initial enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Initial message creation failed: ${error.message}`);
        },
        messageResult
      );

      const iterator = queue[Symbol.asyncIterator]();
      
      // Get first message
      const first = await iterator.next();
      expect(first.done).toBe(false);
      expect(first.value.type).toBe(MessageType.USER_INPUT);
      
      // Inject second message while iterating
      const secondMessageResult = factory.createUserInputMessage('injected', 'cli');
      match(
        secondMessage => {
          const enqueueResult = queue.enqueue(secondMessage);
          match(
            () => {
              // Successfully enqueued injected message
            },
            error => {
              throw new Error(`Injection enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Injected message creation failed: ${error.message}`);
        },
        secondMessageResult
      );
      
      // Get injected message
      const second = await iterator.next();
      expect(second.done).toBe(false);
      expect(second.value.type).toBe(MessageType.USER_INPUT);
    });

    it('should prevent multiple iterations', () => {
      const iterator1 = queue[Symbol.asyncIterator]();
      
      expect(() => {
        queue[Symbol.asyncIterator]();
      }).toThrow('Queue already started - cannot iterate');
    });
  });

  describe('queue state management', () => {
    it('should handle done state correctly', async () => {
      const messageResult = factory.createUserInputMessage('test', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            () => {
              const doneResult = queue.done();
              match(
                async () => {
                  const received = [];
                  for await (const msg of queue) {
                    received.push(msg);
                  }
                  expect(received).toHaveLength(1);
                },
                error => {
                  throw new Error(`Done failed: ${error.message}`);
                },
                doneResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should handle error state correctly', async () => {
      const testError = { code: 'TEST_ERROR', message: 'Test error', category: 'SYSTEM' as const, context: {} };
      
      const errorResult = queue.error(testError);
      match(
        () => {
          const stateResult = queue.getState();
          match(
            state => {
              expect(state.hasError).toBe(true);
              expect(state.errorCount).toBe(1);
            },
            error => {
              throw new Error(`State check failed: ${error.message}`);
            },
            stateResult
          );
        },
        error => {
          throw new Error(`Error setting failed: ${error.message}`);
        },
        errorResult
      );
    });

    it('should prevent enqueue after done', () => {
      const doneResult = queue.done();
      match(
        () => {
          const messageResult = factory.createUserInputMessage('test', 'cli');
          match(
            message => {
              const enqueueResult = queue.enqueue(message);
              match(
                () => {
                  throw new Error('Expected enqueue to fail after done');
                },
                error => {
                  expect(error.code).toBe('QUEUE_DONE');
                },
                enqueueResult
              );
            },
            error => {
              throw new Error(`Message creation failed: ${error.message}`);
            },
            messageResult
          );
        },
        error => {
          throw new Error(`Done failed: ${error.message}`);
        },
        doneResult
      );
    });

    it('should prevent enqueue after error', () => {
      const testError = { code: 'TEST_ERROR', message: 'Test error', category: 'SYSTEM' as const, context: {} };
      
      const errorResult = queue.error(testError);
      match(
        () => {
          const messageResult = factory.createUserInputMessage('test', 'cli');
          match(
            message => {
              const enqueueResult = queue.enqueue(message);
              match(
                () => {
                  throw new Error('Expected enqueue to fail after error');
                },
                error => {
                  expect(error.code).toBe('QUEUE_ERROR');
                },
                enqueueResult
              );
            },
            error => {
              throw new Error(`Message creation failed: ${error.message}`);
            },
            messageResult
          );
        },
        error => {
          throw new Error(`Error setting failed: ${error.message}`);
        },
        errorResult
      );
    });
  });

  describe('queue operations', () => {
    it('should peek at next message without removing', () => {
      const messageResult = factory.createUserInputMessage('test', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            () => {
              const peekResult = queue.peek();
              match(
                peekedMessage => {
                  expect(peekedMessage?.id).toBe(message.id);
                  
                  // Size should still be 1
                  const sizeResult = queue.size();
                  match(
                    size => {
                      expect(size).toBe(1);
                    },
                    error => {
                      throw new Error(`Size check failed: ${error.message}`);
                    },
                    sizeResult
                  );
                },
                error => {
                  throw new Error(`Peek failed: ${error.message}`);
                },
                peekResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should check if queue is empty/full', () => {
      const emptyResult = queue.isEmpty();
      match(
        isEmpty => {
          expect(isEmpty).toBe(true);
          
          const fullResult = queue.isFull();
          match(
            isFull => {
              expect(isFull).toBe(false);
            },
            error => {
              throw new Error(`Full check failed: ${error.message}`);
            },
            fullResult
          );
        },
        error => {
          throw new Error(`Empty check failed: ${error.message}`);
        },
        emptyResult
      );
    });

    it('should clear all messages', () => {
      const messageResult = factory.createUserInputMessage('test', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            () => {
              const clearResult = queue.clear();
              match(
                clearedCount => {
                  expect(clearedCount).toBe(1);
                  
                  const emptyResult = queue.isEmpty();
                  match(
                    isEmpty => {
                      expect(isEmpty).toBe(true);
                    },
                    error => {
                      throw new Error(`Empty check failed: ${error.message}`);
                    },
                    emptyResult
                  );
                },
                error => {
                  throw new Error(`Clear failed: ${error.message}`);
                },
                clearResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should handle pause/resume operations', () => {
      const pauseResult = queue.pause();
      match(
        () => {
          const pausedResult = queue.isPaused();
          match(
            isPaused => {
              expect(isPaused).toBe(true);
              
              const resumeResult = queue.resume();
              match(
                () => {
                  const pausedAfterResumeResult = queue.isPaused();
                  match(
                    isPausedAfterResume => {
                      expect(isPausedAfterResume).toBe(false);
                    },
                    error => {
                      throw new Error(`Paused check after resume failed: ${error.message}`);
                    },
                    pausedAfterResumeResult
                  );
                },
                error => {
                  throw new Error(`Resume failed: ${error.message}`);
                },
                resumeResult
              );
            },
            error => {
              throw new Error(`Paused check failed: ${error.message}`);
            },
            pausedResult
          );
        },
        error => {
          throw new Error(`Pause failed: ${error.message}`);
        },
        pauseResult
      );
    });
  });

  describe('size limits and constraints', () => {
    it('should respect maximum size limit', () => {
      const limitedQueue = new QiAsyncMessageQueue({ maxSize: 2 });
      
      const message1Result = factory.createUserInputMessage('test 1', 'cli');
      const message2Result = factory.createUserInputMessage('test 2', 'cli');
      const message3Result = factory.createUserInputMessage('test 3', 'cli');
      
      match(
        message1 => {
          match(
            message2 => {
              match(
                message3 => {
                  // Enqueue first two should succeed
                  const enqueue1 = limitedQueue.enqueue(message1);
                  const enqueue2 = limitedQueue.enqueue(message2);
                  
                  match(
                    () => {
                      match(
                        () => {
                          // Third should fail
                          const enqueue3 = limitedQueue.enqueue(message3);
                          match(
                            () => {
                              throw new Error('Expected third enqueue to fail due to size limit');
                            },
                            error => {
                              expect(error.code).toBe('QUEUE_FULL');
                            },
                            enqueue3
                          );
                        },
                        error => {
                          throw new Error(`Second enqueue failed: ${error.message}`);
                        },
                        enqueue2
                      );
                    },
                    error => {
                      throw new Error(`First enqueue failed: ${error.message}`);
                    },
                    enqueue1
                  );
                },
                error => {
                  throw new Error(`Message 3 creation failed: ${error.message}`);
                },
                message3Result
              );
            },
            error => {
              throw new Error(`Message 2 creation failed: ${error.message}`);
            },
            message2Result
          );
        },
        error => {
          throw new Error(`Message 1 creation failed: ${error.message}`);
        },
        message1Result
      );
    });

    it('should handle TTL expiration', async () => {
      const ttlQueue = new QiAsyncMessageQueue({ messageTtl: 10 }); // 10ms TTL
      
      const messageResult = factory.createUserInputMessage('test', 'cli');
      match(
        message => {
          const enqueueResult = ttlQueue.enqueue(message);
          match(
            async () => {
              // Wait for TTL to expire
              await new Promise(resolve => setTimeout(resolve, 20));
              
              const peekResult = ttlQueue.peek();
              match(
                peekedMessage => {
                  expect(peekedMessage).toBeNull(); // Should be expired
                },
                error => {
                  throw new Error(`Peek after TTL failed: ${error.message}`);
                },
                peekResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });
  });

  describe('statistics and monitoring', () => {
    it('should track statistics when enabled', () => {
      const statsQueue = new QiAsyncMessageQueue({ enableStats: true });
      
      const messageResult = factory.createUserInputMessage('test', 'cli');
      match(
        message => {
          const enqueueResult = statsQueue.enqueue(message);
          match(
            () => {
              const statsResult = statsQueue.getStats();
              match(
                stats => {
                  expect(stats?.totalMessages).toBe(1);
                  expect(stats?.queueLength).toBe(1);
                },
                error => {
                  throw new Error(`Stats check failed: ${error.message}`);
                },
                statsResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should return null stats when disabled', () => {
      const noStatsQueue = new QiAsyncMessageQueue({ enableStats: false });
      
      const statsResult = noStatsQueue.getStats();
      match(
        stats => {
          expect(stats).toBeNull();
        },
        error => {
          throw new Error(`Stats check failed: ${error.message}`);
        },
        statsResult
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle concurrent enqueue operations', () => {
      const messageResults = Array.from({ length: 10 }, (_, i) =>
        factory.createUserInputMessage(`message ${i}`, 'cli')
      );

      const enqueueResults = messageResults.map(messageResult =>
        match(
          message => queue.enqueue(message),
          error => {
            throw new Error(`Message creation failed: ${error.message}`);
          },
          messageResult
        )
      );

      // All enqueues should succeed
      for (const result of enqueueResults) {
        match(
          () => {
            // Successfully enqueued
          },
          error => {
            throw new Error(`Enqueue failed: ${error.message}`);
          },
          result
        );
      }

      const sizeResult = queue.size();
      match(
        size => {
          expect(size).toBe(10);
        },
        error => {
          throw new Error(`Size check failed: ${error.message}`);
        },
        sizeResult
      );
    });

    it('should cleanup resources properly on destroy', async () => {
      const messageResult = factory.createUserInputMessage('test', 'cli');
      
      match(
        message => {
          const enqueueResult = queue.enqueue(message);
          match(
            async () => {
              const destroyResult = await queue.destroy();
              match(
                () => {
                  const emptyResult = queue.isEmpty();
                  match(
                    isEmpty => {
                      expect(isEmpty).toBe(true);
                    },
                    error => {
                      throw new Error(`Empty check after destroy failed: ${error.message}`);
                    },
                    emptyResult
                  );
                },
                error => {
                  throw new Error(`Destroy failed: ${error.message}`);
                },
                destroyResult
              );
            },
            error => {
              throw new Error(`Enqueue failed: ${error.message}`);
            },
            enqueueResult
          );
        },
        error => {
          throw new Error(`Message creation failed: ${error.message}`);
        },
        messageResult
      );
    });

    it('should handle destroy with pending iterator', async () => {
      const iterator = queue[Symbol.asyncIterator]();
      
      const destroyResult = await queue.destroy();
      match(
        () => {
          // Should have destroyed successfully
        },
        error => {
          throw new Error(`Destroy with pending iterator failed: ${error.message}`);
        },
        destroyResult
      );
    });
  });
});