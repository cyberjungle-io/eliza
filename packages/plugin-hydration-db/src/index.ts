import type { Plugin, Action, IAgentRuntime, Memory, State, HandlerCallback, Content } from './types';
import pkg from 'pg';
const { Pool } = pkg;

// Create a connection pool
const pool = new Pool({
  host: process.env.HYDRATION_DB_HOST,
  port: parseInt(process.env.HYDRATION_DB_PORT || '5432'),
  database: process.env.HYDRATION_DB_NAME,
  user: process.env.HYDRATION_DB_USER,
  password: process.env.HYDRATION_DB_PASSWORD
});

// Create simplified test actions
const executeQuery: Action = {
  name: 'EXECUTE_QUERY',
  description: 'Execute a SQL query against the Hydration database',
  similes: ['executeQuery', 'EXECUTE_QUERY', 'runQuery'],
  examples: [
    [{
      user: 'hydration-db',
      content: {
        text: 'SELECT * FROM table_name',
        action: 'EXECUTE_QUERY'
      } as Content
    }]
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('[executeQuery] Validating action...');
    console.log('[executeQuery] Message content:', JSON.stringify(message.content, null, 2));
    return true;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback) => {
    console.log('[executeQuery] === Executing query ===');
    console.log('[executeQuery] Message source:', message.content.source);
    console.log('[executeQuery] Message response:', JSON.stringify(message.content.response, null, 2));
    
    try {
      // If this is a direct message from user (not LLM response)
      if (message.content.source === 'direct' && !message.content.response) {
        console.log('[executeQuery] Direct message received - returning to let LLM generate SQL');
        return {
          text: message.content.text,
          content: {
            status: 'pending',
            message: 'Processing query...'
          }
        };
      }

      // Extract SQL query from message
      let sqlQuery: string | undefined;
      
      if (message.content.response?.content?.text) {
        // Extract from LLM response
        sqlQuery = message.content.response.content.text.trim();
        console.log('[executeQuery] Raw LLM response:', sqlQuery);
        
        // Try to extract SQL if it's embedded in other text
        const sqlMatch = sqlQuery.match(/SELECT[\s\S]*?(?:;|\n*$)/i);
        if (sqlMatch) {
          sqlQuery = sqlMatch[0].trim();
          console.log('[executeQuery] Extracted SQL query:', sqlQuery);
        } else {
          // If no SELECT found, try to use the entire response if it looks like SQL
          if (sqlQuery.toUpperCase().includes('SELECT') && 
              sqlQuery.toUpperCase().includes('FROM')) {
            console.log('[executeQuery] Using full response as SQL:', sqlQuery);
          } else {
            console.log('[executeQuery] No valid SQL found in response');
            return {
              text: 'No valid SQL query found in response',
              content: {
                status: 'error',
                error: 'No valid SQL query found in response'
              }
            };
          }
        }
        
        if (!sqlQuery.toUpperCase().startsWith('SELECT')) {
          console.log('[executeQuery] Invalid SQL - must start with SELECT');
          return {
            text: 'Invalid SQL query - must start with SELECT',
            content: {
              status: 'error',
              error: 'Generated query must start with SELECT'
            }
          };
        }
      } else if (message.content.text) {
        sqlQuery = message.content.text.trim();
        console.log('[executeQuery] Using direct text as SQL:', sqlQuery);
      }

      if (!sqlQuery || typeof sqlQuery !== 'string' || !sqlQuery.toLowerCase().includes('select')) {
        console.log('[executeQuery] Invalid or missing SQL query');
        return {
          text: 'Invalid or missing SQL query',
          content: {
            status: 'error',
            error: 'Invalid or missing SQL query'
          }
        };
      }

      // Clean and execute the query
      const query = sqlQuery.trim();
      console.log('[executeQuery] Final SQL query to execute:', query);
      const result = await pool.query(query);
      console.log('[executeQuery] Query executed successfully');
      
      const response = {
        text: JSON.stringify({
          rows: result.rows,
          rowCount: result.rowCount
        }),
        content: { 
          status: 'success',
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields?.map(f => f.name)
        }
      };

      if (callback) {
        console.log('[executeQuery] Calling callback with response');
        await callback(response);
      }

      return response;

    } catch (error) {
      console.error('[executeQuery] Error:', error);
      
      const errorResponse = {
        text: `Error executing query: ${error.message}`,
        content: { 
          status: 'error',
          error: error.message
        }
      };

      if (callback) {
        console.log('[executeQuery] Calling callback with error response');
        await callback(errorResponse);
      }

      return errorResponse;
    }
  }
};

const testDbConnection: Action = {
  name: 'TEST_DB_CONNECTION',
  description: 'Test the database connection',
  similes: ['testDb', 'TEST_DB', 'testConnection'],
  examples: [
    [{
      user: 'hydration-db',
      content: {
        text: 'test database connection',
        action: 'TEST_DB_CONNECTION'
      } as Content
    }]
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('[testDbConnection] Validating action...');
    return true;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback) => {
    console.log('[testDbConnection] === Testing connection ===');
    
    try {
      // Test the connection with the specific query
      console.log("*****************************************");
      const query = 'SELECT number, onfinalize FROM blocks ORDER BY number ASC LIMIT 5';
      console.log('[testDbConnection] Executing query:', query);
      const result = await pool.query(query);
      console.log('[testDbConnection] Query successful');
      console.log('[testDbConnection] Result:', JSON.stringify(result, null, 2));
      
      const response = {
        text: JSON.stringify({
          query: query,
          rows: result.rows,
          rowCount: result.rowCount
        }),
        content: { 
          status: 'success',
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields?.map(f => f.name)
        }
      };

      if (callback) {
        await callback(response);
      }

      return response;
    } catch (error) {
      console.error('[testDbConnection] Error:', error);
      
      const errorResponse = {
        text: `Query failed: ${error.message}`,
        content: { 
          status: 'error',
          error: error.message,
          stack: error.stack
        }
      };

      if (callback) {
        await callback(errorResponse);
      }

      return errorResponse;
    }
  }
};

// Create the plugin instance
console.log('[hydration-db] Creating plugin...');

const plugin: Plugin = {
  name: '@elizaos/plugin-hydration-db',
  description: 'Plugin for interacting with the Hydration database',
  actions: [executeQuery, testDbConnection]
};

console.log('[hydration-db] Plugin created with actions:', plugin.actions.map(a => a.name));

export const hydrationDbPlugin = plugin;
export default plugin; 
