using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PersistWorkoutExerciseReplacement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OriginalExerciseId",
                table: "WorkoutLogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReplacementOrder",
                table: "WorkoutLogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int[]>(
                name: "ReplacementSetOrders",
                table: "WorkoutLogEntries",
                type: "integer[]",
                nullable: false,
                defaultValue: new int[0]);

            migrationBuilder.AddColumn<int[]>(
                name: "ReplacementSetSides",
                table: "WorkoutLogEntries",
                type: "integer[]",
                nullable: false,
                defaultValue: new int[0]);

            migrationBuilder.AddColumn<bool[]>(
                name: "ReplacementWarmups",
                table: "WorkoutLogEntries",
                type: "boolean[]",
                nullable: false,
                defaultValue: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalExerciseId",
                table: "WorkoutLogEntries");

            migrationBuilder.DropColumn(
                name: "ReplacementOrder",
                table: "WorkoutLogEntries");

            migrationBuilder.DropColumn(
                name: "ReplacementSetOrders",
                table: "WorkoutLogEntries");

            migrationBuilder.DropColumn(
                name: "ReplacementSetSides",
                table: "WorkoutLogEntries");

            migrationBuilder.DropColumn(
                name: "ReplacementWarmups",
                table: "WorkoutLogEntries");
        }
    }
}
