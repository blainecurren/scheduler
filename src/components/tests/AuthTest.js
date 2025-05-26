import React, { useState } from "react";
import {
  testAuthentication,
  getBearerToken,
  clearCachedToken,
} from "../../services/fhir/AuthService";
import "./AuthTest.css";

const AuthTest = () => {
  const [testStatus, setTestStatus] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAuthTest = async () => {
    setIsLoading(true);
    setError(null);
    setTestStatus("Testing authentication...");

    try {
      // Test authentication
      const authSuccess = await testAuthentication();

      if (authSuccess) {
        setTestStatus("Authentication successful");

        // Get token details
        const token = await getBearerToken();
        setTokenInfo({
          tokenLength: token.length,
          tokenPreview: `${token.substring(0, 20)}...${token.substring(
            token.length - 10
          )}`,
          timestamp: new Date().toLocaleString(),
        });
      } else {
        setTestStatus("Authentication failed");
        setError("Failed to authenticate with HCHB API");
      }
    } catch (err) {
      setTestStatus("Authentication error");
      setError(err.message);
      console.error("Authentication test error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hchb-auth-test">
      <h2>HCHB FHIR API Authentication Test</h2>
      <div className="test-controls">
        <button
          onClick={runAuthTest}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {" "}
          {isLoading ? "Testing..." : "Test Authentication"}{" "}
        </button>{" "}
        <button
          onClick={handleClearCache}
          className="btn btn-secondary"
          disabled={isLoading}
        >
          {" "}
          Clear Token Cache{" "}
        </button>{" "}
      </div>{" "}
      {testStatus && (
        <div className={`test-status ${error ? "error" : "success"}`}>
          {" "}
          <h3>Status:</h3> <p>{testStatus}</p>{" "}
        </div>
      )}{" "}
      {error && (
        <div className="error-details">
          {" "}
          <h3>Error Details:</h3> <pre>{error}</pre>{" "}
        </div>
      )}{" "}
      {tokenInfo && (
        <div className="token-info">
          {" "}
          <h3>Token Information:</h3>{" "}
          <ul>
            {" "}
            <li>
              <strong>Token Length:</strong> {tokenInfo.tokenLength} characters
            </li>{" "}
            <li>
              <strong>Token Preview:</strong>{" "}
              <code>{tokenInfo.tokenPreview}</code>
            </li>{" "}
            <li>
              <strong>Retrieved At:</strong> {tokenInfo.timestamp}
            </li>{" "}
          </ul>{" "}
        </div>
      )}{" "}
      <div className="test-notes">
        {" "}
        <h3>Test Notes:</h3>{" "}
        <ul>
          {" "}
          <li>
            This test verifies that we can authenticate with the HCHB FHIR API
          </li>{" "}
          <li>A successful test will display token information</li>{" "}
          <li>The token is cached to avoid unnecessary API calls</li>{" "}
          <li>Use "Clear Token Cache" to force a new authentication</li>{" "}
        </ul>{" "}
      </div>{" "}
    </div>
  );
};
export default AuthTest;
