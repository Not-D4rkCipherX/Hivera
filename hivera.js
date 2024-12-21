import fetch from "node-fetch";
import fs from "fs/promises";
import log from "./utils/logger_2.js";
import beddu from "./utils/banner.js";
import { headers } from "./utils/header.js";
import { settings } from "./config.js";
import { checkBaseUrl } from "./checkAPI.js";
// The API base URL
const baseURL = settings.BASE_URL;

async function readUserFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const userArray = data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    if (userArray.length === 0) {
      log.warn("No users found in the file.");
    }
    return userArray;
  } catch (error) {
    log.error("Error reading file:", error);
    return [];
  }
}

async function fetchAuthData(userData) {
  try {
    const response = await fetch(`${baseURL}/auth?auth_data=${encodeURIComponent(userData)}`, {
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error fetching auth data:", error);
    return null;
  }
}

async function fetchInfoData(userData) {
  try {
    const response = await fetch(`${baseURL}/engine/info?auth_data=${encodeURIComponent(userData)}`, {
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error fetching info data:", error);
    return null;
  }
}

async function fetchActivesData(userData) {
  try {
    const response = await fetch(`${baseURL}/engine/activities?auth_data=${encodeURIComponent(userData)}`, {
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error fetching actives data:", error);
    return null;
  }
}

async function fetchModelsData(userData) {
  try {
    const response = await fetch(`${baseURL}/users/modes?auth_data=${encodeURIComponent(userData)}`, {
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error fetching models data:", error);
    return null;
  }
}

async function fetchPowerData(userData) {
  try {
    const response = await fetch(`${baseURL}/users/powers?auth_data=${encodeURIComponent(userData)}`, {
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error fetching power data:", error);
    return null;
  }
}

function generatePayload() {
  const fromDate = Date.now();
  const values = [90, 94, 95, 97, 99];
  const qualityConnection = values[Math.floor(Math.random() * values.length)];
  return {
    from_date: fromDate,
    quality_connection: qualityConnection,
    times: 1,
  };
}

async function contribute(userData, times) {
  try {
    const payload = generatePayload();
    const response = await fetch(`${baseURL}/v2/engine/contribute?auth_data=${encodeURIComponent(userData)}`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        ...payload,
        times: times,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error in contribute:", error);
    return error;
  }
}

async function completeTask(userData, id) {
  let taskid = id;
  let url = `${baseURL}/missions/complete?mission_id=${taskid}&&auth_data=${encodeURIComponent(userData)}`;

  if (taskid.toString().includes("daily")) {
    taskid = taskid.replace("daily_", "");
    url = `${baseURL}/daily-tasks/complete?task_id=${taskid}&&auth_data=${encodeURIComponent(userData)}`;
  }
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error in Complete task:", error);
    return null;
  }
}

async function handleTasks(userData) {
  try {
    let misssions = await getTask(userData);
    let tasksDaily = await getDailyTask(userData);
    let tasks = [];
    if (misssions?.result) {
      misssions = misssions.result.filter((t) => !t.complete && !settings.SKIP_TASKS.includes(t.id));
    }
    if (tasksDaily?.result) {
      tasksDaily = tasksDaily.result.map((t) => ({ ...t, id: `daily_${t.id}` })).filter((t) => !t.complete && !settings.SKIP_TASKS.includes(t.id));
    }

    tasks = [...misssions, ...tasksDaily];

    for (const task of tasks) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      log.info(`Starting task ${task.id} | ${task.name}...`);

      const res = await completeTask(userData, task.id);
      if (res?.result == "done") {
        log.info(`Task ${task.id} | ${task.name} completed successfully`);
      }
    }

    return log.debug(`Completed tasks!`);
  } catch (error) {
    return log.error(`Failed to handle tasks: ${error.message}`);
  }
}

async function getTask(userData) {
  try {
    const response = await fetch(`${baseURL}/missions?auth_data=${encodeURIComponent(userData)}`, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error in getTask:", error);
    return null;
  }
}

async function getDailyTask(userData) {
  try {
    const response = await fetch(`${baseURL}/daily-tasks?auth_data=${encodeURIComponent(userData)}`, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    log.error("Error in getDailyTask:", error);
    return null;
  }
}

async function processUser(userData) {
  let times = 1;
  let username = "Unknown";
  let initPower = 0;

  try {
    const info = await fetchInfoData(userData);
    await fetchModelsData(userData);
    const profile = await fetchAuthData(userData);
    username = profile?.result?.username || "Unknown";

    // const models = modelsData?.result?.filter((m) => m.quantity == 1) || [];

    const powerData = await fetchPowerData(userData);
    let currhivera = powerData?.result?.HIVERA || 0;
    let power = powerData?.result?.POWER || 0;
    initPower = power;
    let powerCapacity = powerData?.result?.POWER_CAPACITY || 0;

    log.info(`Username: ${username} | Hivera: ${currhivera.toFixed(2)} | Power: ${power} | Power Capacity: ${powerCapacity}`);

    if (settings.AUTO_TASK) {
      log.info(`Getting tasks...`);
      await handleTasks(userData);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    await fetchActivesData(userData);
    log.info(`[Account ${username}] | Ping after 30 seconds | Hivera will be updated after 5 minutes`);
    // Start mining
    while (power > 500) {
      log.info(`[Account ${username}] | Hivera: ${currhivera.toFixed(2)} | Power: ${power}| Ping successfull!`);
      power -= 500;
      times++;
      if (times === 10) {
        const contributeData = await contribute(userData, times);
        if (contributeData?.result) {
          const { HIVERA, POWER } = contributeData?.result?.profile;
          power = POWER || 0;
          log.info(`Mining successfully for user: ${username}`);
          log.info(`[Account ${username}] | Hivera: ${HIVERA.toFixed(2)} \x1b[32m(+${(+HIVERA - +currhivera).toFixed(2)})\x1b[0m | Power: ${power}`);
          log.info(`[Account ${username}] | Ping after 30 seconds | Hivera will be updated after 5 minutes`);
          currhivera = HIVERA;
          times = 1;
        } else {
          return log.error(`[Account ${username}] Error contribute...`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
    }

    // stop minning
    if (initPower > 500) {
      const newContributeData = await contribute(userData, times);
      const { HIVERA: newHivera } = newContributeData?.result?.profile;
      log.warn(`User ${username} does not have enough power to mine | New Balance: ${newHivera.toFixed(2)} \x1b[32m(+${(newHivera - currhivera).toFixed(2)})\x1b[0m ...Skipping`);
    } else {
      log.warn(`User ${username} does not have enough power to mine...Skipping`);
    }

    return;
  } catch (error) {
    log.error(`Error processing user ${username}:`, error.message);
    return;
  }
}

async function main() {
  log.info(beddu);
  const { endpoint: baseURL, message } = await checkBaseUrl();
  console.log(`\x1b[33m${message}\x1b[0m`);
  // console.log(`${baseURL}`);
  if (!baseURL) return console.log(`\x1b[31mCannot find API ID, try again later!\x1b[0m`);
  const userDatas = await readUserFile("data.txt");

  if (userDatas.length === 0) {
    log.error("No user data found in the file.");
    process.exit(0);
  }

  while (true) {
    log.info("Starting processing for all users...");
    await Promise.all(
      userDatas.map(async (userData, index) => {
        await processUser(userData);
      })
    );

    log.info(`All users processed. Restarting the loop after ${settings.TIME_SLEEP} minutes...`);
    await new Promise((resolve) => setTimeout(resolve, settings.TIME_SLEEP * 60 * 1000));
  }
}

// Run
main().catch((error) => {
  log.error("An unexpected error occurred:", error);
});
