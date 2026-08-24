import ortools.linear_solver.pywraplp as pywraplp

class InterventionOptimizer:
    def __init__(self):
        # Candidate intervention database for Roorkee & Haridwar Municipality
        self.candidate_actions = [
            {
                "id": "ACT-01",
                "name": "Desilt & Clean Solani River Outfall Drain D17 (Roorkee)",
                "type": "Desilting",
                "cost_lakhs": 2.0,
                "target_zone": "ZONE-RK03",
                "risk_reduction_pct": 32.0,
                "population_protected": 38000
            },
            {
                "id": "ACT-02",
                "name": "Civil Lines Stormwater Nullah Clearance D02 (Roorkee)",
                "type": "Desilting",
                "cost_lakhs": 1.2,
                "target_zone": "ZONE-RK02",
                "risk_reduction_pct": 24.0,
                "population_protected": 45000
            },
            {
                "id": "ACT-03",
                "name": "Deploy Mobile High-Volume Pump P02 (IIT Roorkee / Solani)",
                "type": "Pumping Station",
                "cost_lakhs": 4.5,
                "target_zone": "ZONE-RK03",
                "risk_reduction_pct": 38.0,
                "population_protected": 28000
            },
            {
                "id": "ACT-04",
                "name": "Jwalapur Old Canal Drain Expansion D08 (Haridwar)",
                "type": "Drain Expansion",
                "cost_lakhs": 7.5,
                "target_zone": "ZONE-HW02",
                "risk_reduction_pct": 40.0,
                "population_protected": 85000
            },
            {
                "id": "ACT-05",
                "name": "Install Inflatable Flood Barrier B01 (Har Ki Pauri Ghats)",
                "type": "Temporary Barrier",
                "cost_lakhs": 3.0,
                "target_zone": "ZONE-HW01",
                "risk_reduction_pct": 28.0,
                "population_protected": 65000
            },
            {
                "id": "ACT-06",
                "name": "Clear Bahadrabad Canal Outflow Culvert C04",
                "type": "Culvert Clearance",
                "cost_lakhs": 1.8,
                "target_zone": "ZONE-HW05",
                "risk_reduction_pct": 22.0,
                "population_protected": 42000
            }
        ]

    def optimize_plan(self, budget_lakhs=10.0, rainfall_24h_mm=100.0):
        """
        Uses Google OR-Tools Integer Linear Program (0-1 Knapsack Solver) to find
        the optimal intervention plan maximizing (Risk Reduction * Population Protected)
        under the strict municipal budget constraint.
        """
        solver = pywraplp.Solver.CreateSolver('SCIP')
        if not solver:
            solver = pywraplp.Solver.CreateSolver('CBC')
            
        n_items = len(self.candidate_actions)
        x = {}
        for i in range(n_items):
            x[i] = solver.BoolVar(f'x_{i}')
            
        # Budget constraint: sum(cost[i] * x[i]) <= budget
        budget_constraint = solver.Constraint(0, budget_lakhs, 'budget_constraint')
        for i in range(n_items):
            budget_constraint.SetCoefficient(x[i], float(self.candidate_actions[i]["cost_lakhs"]))
            
        # Objective: Maximize score = sum(population_protected[i] * risk_reduction_pct[i] * x[i])
        objective = solver.Objective()
        for i in range(n_items):
            score = self.candidate_actions[i]["population_protected"] * self.candidate_actions[i]["risk_reduction_pct"]
            objective.SetCoefficient(x[i], float(score))
        objective.SetMaximization()
        
        status = solver.Solve()
        
        selected_actions = []
        total_cost = 0.0
        total_pop_protected = 0
        total_risk_reduction = 0.0
        
        if status == pywraplp.Solver.OPTIMAL or status == pywraplp.Solver.FEASIBLE:
            for i in range(n_items):
                if x[i].solution_value() > 0.5:
                    action = self.candidate_actions[i]
                    selected_actions.append(action)
                    total_cost += action["cost_lakhs"]
                    total_pop_protected += action["population_protected"]
                    total_risk_reduction += action["risk_reduction_pct"]
                    
        # Calculate impact on Solani Aqueduct / Civil Lines as specific example for presentation
        baseline_solani_risk = 89.0
        reduced_solani_risk = round(max(22.0, baseline_solani_risk - sum(a["risk_reduction_pct"] for a in selected_actions if a["target_zone"] in ["ZONE-RK03", "ZONE-RK02"])), 1)
        
        return {
            "budget_allocated_lakhs": budget_lakhs,
            "total_cost_lakhs": round(total_cost, 2),
            "remaining_budget_lakhs": round(budget_lakhs - total_cost, 2),
            "total_population_protected": total_pop_protected,
            "estimated_overall_risk_reduction_pct": round(total_risk_reduction / len(selected_actions) if selected_actions else 0, 1),
            "zone_14_before_risk": baseline_solani_risk,
            "zone_14_after_risk": reduced_solani_risk,
            "recommended_actions": selected_actions,
            "summary_text": f"Recommended plan deploys {len(selected_actions)} interventions totaling ₹{total_cost:.1f} Lakhs, protecting {total_pop_protected:,} citizens and reducing Solani Aqueduct risk from {baseline_solani_risk}% to {reduced_solani_risk}%."
        }

optimizer_service = InterventionOptimizer()
